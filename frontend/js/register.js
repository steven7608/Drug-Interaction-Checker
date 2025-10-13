document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const userId = document.getElementById("userId").value.trim();
    const phoneNumber = (document.getElementById("phoneNumber")?.value || "").trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    if (!userId) {
        alert("Please enter a unique User ID.");
        return;
    }

    try {
        // Cache profile data in case email confirmation is enabled
        const pendingProfile = {
            userid: userId,
            email: email,
            fullname: fullName,
            phonenumber: phoneNumber || null,
            role: role
        };
        localStorage.setItem("pendingProfile", JSON.stringify(pendingProfile));

        // Sign up with Supabase Auth (with explicit email redirect)
        const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
        const redirectTo = origin + '/auth-callback.html';
        const signUp = await supabaseAuthSignUp(email, password, redirectTo);
        if (signUp.error) throw new Error(signUp.error.message || "Signup failed");

        // If email confirmations are disabled, we get a session with access_token
        const session = signUp.session || signUp;
        if (!session || !session.access_token) {
            alert("Account created. Please check your email to confirm before logging in.");
            window.location.href = "home.html";
            return;
        }

        saveSession(session, email);

        // Insert profile row into user_accounts table via REST
        const accessToken = getAccessToken();
        const profile = [{
            userid: userId,
            email: email,
            fullname: fullName,
            phonenumber: phoneNumber || null,
            role: role
        }];

        await supabaseRequest({
            method: "POST",
            path: "user_accounts",
            body: profile,
            accessToken
        });

        // Clear pending profile cache
        localStorage.removeItem("pendingProfile");

        alert("Account created successfully.");
        window.location.href = "home.html";
    } catch (err) {
        alert(`Registration error: ${err.message}`);
    }
});
