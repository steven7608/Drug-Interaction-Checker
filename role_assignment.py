class User:
    def __init__(self, username, role="Patient"):
        self.username = username
        self.role = role # Default role is "Patient" unless specified otherwise
        
    def set_role(self, new_role):
        # Assign a new role to the user if valid
        valid_roles = ["Patient", "Doctor", "Admin"]
        if new_role in valid_roles:
            self.role = new_role
        else:
            raise ValueError(f"Invalid role: {new_role}. Valid roles are: {valid_roles}")
        
    def get_role(self):
        # Return the current role of the user
        return self.role
    def __str__(self):
        return f"User: {self.username}, Role: {self.role}"
    
if __name__ == "__main__":
    # Examples of users with different roles
    user1 = User("Alice") # Default role "Patient"
    user2 = User("Bob", "Doctor")
    user3 = User("Charlie", "Admin")
    
    
    for user in [user1, user2, user3]:
        print(user)
        
    # Change role of a user
    user1.set_role("Doctor")
    print(f"After role change: {user1}")