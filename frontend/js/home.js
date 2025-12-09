/*
    home.js   Virginia Tech       Sprint 1,2,3
    Main landing page with login form and redirection based on role assignment

    Home page that allows user logins and redirects based on role- doctor, administrator, patient
*/

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const signIn = await supabaseAuthSignIn(email, password);
        if (signIn.error) throw new Error(signIn.error_description || signIn.error || "Login failed");

        const session = signIn;
        if (!session || !session.access_token) throw new Error("No access token returned");
        saveSession(session, email);
        // Ensure profile exists before redirect
        const token = getAccessToken();
        let users = await supabaseRequest({
            method: "GET",
            path: "user_accounts",
            accessToken: token,
            query: `?select=id,userid,role,fullname,email&email=eq.${encodeURIComponent(email)}`
        });
        if (!users || users.length === 0) {
            try {
                const pending = localStorage.getItem('pendingProfile');
                let profile = pending ? JSON.parse(pending) : null;
                if (!profile) {
                    profile = { userid: generateUserId(), email: email, fullname: email, phonenumber: null, role: 'patient' };
                }
                await supabaseRequest({ method: 'POST', path: 'user_accounts', accessToken: token, body: [profile] });
                users = [profile];
            } catch (_) {  }
        }

        // Redirect to appropriate home page based on role
        const role = (users && users[0] && users[0].role) || 'patient';
        try { localStorage.setItem('sbRole', role); } catch (_) {}
        if (role === 'doctor') {
            window.location.href = "doctor.html";
        }else if (role === 'administrator') {
            window.location.href = "admin.html";
        }  else {
            window.location.href = "patient.html";
        }
    } catch (err) {
        alert(`Login error: ${err.message}`);
    }
});


// Redirect to appropritae role page if curr logged in using access token
(async function redirectIfLoggedIn() {
    try {
        const token = getAccessToken?.();
        const email = getEmail?.();
        if (!token || !email) return;

        const users = await supabaseRequest({
            method: "GET",
            path: "user_accounts",
            accessToken: token,
            query: `?select=role,email&email=eq.${encodeURIComponent(email)}&limit=1`
        });

        const role = (users && users[0] && users[0].role) || "patient";
        try { localStorage.setItem('sbRole', role); } catch (_) {}
        window.location.href =
            role === "doctor" ? "doctor.html" :
            role === "administrator" ? "admin.html" :
            "patient.html";
    } catch (_) {
    }
})();

