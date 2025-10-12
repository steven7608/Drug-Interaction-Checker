# role_assignment.py

VALID_ROLES = ["Patient", "Doctor", "Admin"]
class User:
    def __init__(self, username, role="Patient"):
        self.username = username
        self.role = self.validate_role(role)  # validate on creation

    def validate_role(self, role: str):
        """Ensure the role is one of the valid ones."""
        if role not in VALID_ROLES:
            raise ValueError(f"Invalid role: {role}. Must be one of {VALID_ROLES}")
        return role

    def set_role(self, new_role: str):
        """Assign a new role to the user if valid."""
        self.role = self.validate_role(new_role)

    def get_role(self):
        """Return the current role of the user."""
        return self.role

    def __str__(self):
        return f"User: {self.username}, Role: {self.role}"


# --- Permission helper functions ---
def can_manage_medications(role: str) -> bool:
    """Check if role is allowed to add or edit medications."""
    return role in ["Doctor", "Admin"]

def can_manage_users(role: str) -> bool:
    """Check if role can create, delete, or modify user roles."""
    return role == "Admin"


# --- Example usage ---
if __name__ == "__main__":
    # Create users with different roles
    user1 = User("Alice")  # Default role: Patient
    user2 = User("Bob", "Doctor")
    user3 = User("Charlie", "Admin")

    for user in [user1, user2, user3]:
        print(user)

    # Change role of a user
    user1.set_role("Doctor")
    print(f"\nAfter role change: {user1}")

    # Check permissions
    print(f"\nCan {user1.username} manage medications? {can_manage_medications(user1.role)}")
    print(f"Can {user1.username} manage users? {can_manage_users(user1.role)}")
