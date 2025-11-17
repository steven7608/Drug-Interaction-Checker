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
        //cache profile data in case email confirmation is enabled
        const pendingProfile = {
            userid: userId,
            email: email,
            fullname: fullName,
            phonenumber: phoneNumber || null,
            role: role
        };
        localStorage.setItem("pendingProfile", JSON.stringify(pendingProfile));

        //preemptively check for duplicate userids
        try {
            const existingUserId = await supabaseRequest({
                method: "GET",
                path: "user_accounts",
                query: `?select=id&userid=eq.${encodeURIComponent(userId)}`
            });
            if (existingUserId && existingUserId.length > 0) {
                alert("That username is taken. Please choose another.");
                return;
            }
        } catch (_) {}

        //premptively check for duplicate emails
        try {
            const existingProfile = await supabaseRequest({
                method: "GET",
                path: "user_accounts",
                query: `?select=id&email=eq.${encodeURIComponent(email)}`
            });
            if (existingProfile && existingProfile.length > 0) {
                alert("An account with this email already exists. Please log in instead.");
                window.location.href = "home.html";
                return;
            }
        } catch (_) {}

        //sign up with Supabase Auth
        const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
        const redirectTo = origin + '/auth-callback.html';
        const signUp = await supabaseAuthSignUp(email, password, redirectTo);
        if (signUp.error) throw new Error(signUp.error.message || "Signup failed");

        //use session access token in the event email confirms are disabled
        const session = signUp.session || signUp;
        if (!session || !session.access_token) {
            alert("Account created. Please check your email to confirm before logging in.");
            window.location.href = "home.html";
            return;
        }

        saveSession(session, email);

        //insert profile row into user_accounts table
        const accessToken = getAccessToken();
        const profile = [{
            userid: userId,
            email: email,
            fullname: fullName,
            phonenumber: phoneNumber || null,
            role: role
        }];

        //do not insert if email is already in use
        const existing = await supabaseRequest({
            method: "GET",
            path: "user_accounts",
            accessToken,
            query: `?select=id&email=eq.${encodeURIComponent(email)}`
        });
        if (!existing || existing.length === 0) {
            //do not insert if userid is already in use
            const existingByUserId = await supabaseRequest({
                method: "GET",
                path: "user_accounts",
                accessToken,
                query: `?select=id&userid=eq.${encodeURIComponent(userId)}`
            });
            if (existingByUserId && existingByUserId.length > 0) {
                alert("That username is taken. Please choose another.");
                return;
            }
            await supabaseRequest({
                method: "POST",
                path: "user_accounts",
                body: profile,
                accessToken
            });
        } else {
            alert("An account with this email already exists. Please log in instead.");
            window.location.href = "home.html";
            return;
        }

        localStorage.removeItem("pendingProfile");

        alert("Account created successfully.");
        window.location.href = "home.html";
    } catch (err) {
        alert(`Registration error: ${err.message}`);
    }
});
