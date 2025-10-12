from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import supabase
from passlib.hash import bcrypt

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
    existing_user = supabase_client.table("users").select("*").eq("email", user.email).execute()

    if existing_user.data:
        raise HTTPException(status_code=400, detail="User already exists")

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
