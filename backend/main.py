from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import supabase
from passlib.hash import bcrypt
from reminders import Reminder, create_reminder, get_reminders_for_user, delete_reminder

import supabase
import httpx


# Supabase setup
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_KEY = "YOUR_SERVICE_ROLE_KEY"
supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

# FastAPI setup
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class User(BaseModel):
    name: str
    email: str
    password: str
    role: str

@app.post("/register")
def register_user(user: User):
    try:
        user.role = validate_role(user.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)
                            )
    existing_user = supabase_client.table("users").select("*").eq("email", user.email).execute()

    if existing_user.data:
        raise HTTPException(status_code=400, detail="User already exists")

    # Validate role before proceeding
    try:
        validate_role(user.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Basic password hash before storing (still no login logic)
    hashed_pw = bcrypt.hash(user.password)

    response = supabase_client.table("users").insert({
        "name": user.name,
        "email": user.email,
        "password": hashed_pw,
        "role": user.role
    }).execute()

    if response.data:
        return {"message": "Account created successfully!"}
    else:
        raise HTTPException(status_code=500, detail="Database insert failed")

@app.get("/check_interactions")
async def check_interactions(
    meds: str = Query(..., description="Comma-separated list of medication names")
):
    """
    Checks possible drug interactions using OpenFDA drug labeling data.
    Example: /check_interactions?meds=ibuprofen,acetaminophen
    """
    med_list = [m.strip() for m in meds.split(",")]
    results = {}

    async with httpx.AsyncClient() as client:
        for med in med_list:
            try:
                # Use query and uppercase to match OpenFDA data
                search_query = (
                    f'openfda.generic_name:"{med.upper()}"'
                    f'+openfda.brand_name:"{med.upper()}"'
                    f'+openfda.substance_name:"{med.upper()}"'
                )
                response = await client.get(
                    OPENFDA_ENDPOINT,
                    params={"search": search_query, "limit": 3},
                    timeout=10.0,
                )
                data = response.json()
                if "results" in data:
                    info = data["results"][0]
                    results[med] = {
                        "brand_name": info.get("openfda", {}).get("brand_name", ["Unknown"])[0],
                        "generic_name": info.get("openfda", {}).get("generic_name", ["Unknown"])[0],
                        "substance_name": info.get("openfda", {}).get("substance_name", ["Unknown"])[0],
                        "interactions": info.get("drug_interactions", []),
                        "warnings": info.get("warnings", []),
                    }
                else:
                    results[med] = {"error": "No data found"}
            except Exception as e:
                results[med] = {"error": str(e)}

    # --- Cross-reference potential interactions ---
    interactions_found = []
    for m1 in med_list:
        for m2 in med_list:
            if m1 != m2:
                for text in results.get(m1, {}).get("interactions", []):
                    if m2.lower() in text.lower():
                        interactions_found.append({
                            "drug_1": m1,
                            "drug_2": m2,
                            "description": text
                        })

    return {
        "query": med_list,
        "results": results,
        "interactions_found": interactions_found
    }

@app.post("/reminders/add")
def add_reminder(reminder: Reminder):
    response = create_reminder(supabase_client, reminder)
    if not response.data:
        raise HTTPException(500, "Failed to save reminder")
    return {"message": "Reminder added successfully"}


@app.get("/reminders/{user_id}")
def get_user_reminders(user_id: str):
    data = get_reminders_for_user(supabase_client, user_id)
    return {"reminders": data}


@app.delete("/reminders/{reminder_id}")
def delete_user_reminder(reminder_id: str):
    delete_reminder(supabase_client, reminder_id)
    return {"message": "Reminder deleted"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
