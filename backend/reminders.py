# reminders.py

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from supabase import Client


# ---------------------------
# Pydantic Reminder Model
# ---------------------------
class Reminder(BaseModel):
    user_id: str
    medication_id: str   # Link to user’s prescriptions
    medication_name: str

    frequency: str               # "once_daily", "twice_daily", "every_8_hours", "weekly", etc.
    times: List[str]             # ["08:00", "20:00"], 24-hour format
    start_date: str              
    end_date: Optional[str]      # null = ongoing

    with_meal: Optional[bool] = False
    notes: Optional[str] = None  # user extra notes


# ---------------------------
# Database Actions
# ---------------------------
def create_reminder(supabase: Client, reminder: Reminder):
    """Insert a customizable reminder into Supabase"""
    
    response = supabase.table("reminders").insert({
        "user_id": reminder.user_id,
        "medication_id": reminder.medication_id,
        "medication_name": reminder.medication_name,
        "frequency": reminder.frequency,
        "times": reminder.times,
        "start_date": reminder.start_date,
        "end_date": reminder.end_date,
        "with_meal": reminder.with_meal,
        "notes": reminder.notes,
        "created_at": datetime.utcnow().isoformat()
    }).execute()

    return response


def get_reminders_for_user(supabase: Client, user_id: str):
    response = (
        supabase.table("reminders")
        .select("*")
        .eq("user_id", user_id)
        .order("start_date")
        .execute()
    )
    return response.data


def delete_reminder(supabase: Client, reminder_id: str):
    return (
        supabase.table("reminders")
        .delete()
        .eq("id", reminder_id)
        .execute()
    )
