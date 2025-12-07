//Everett Miceli
// Top left SVG logo -- when clicked, returns to home page

const logoSVG = "logo2.svg";

(function () {
  function ensureLogo() {
    //if (currentPage === "home.html") return; // don't display on home page itself
    if (document.getElementById("appLogo")) return;
    const img = document.createElement("img");
    img.id = "appLogo";
    img.src = logoSVG;
    img.className = "app-logo";
    img.addEventListener("click", onLogoClick);
    document.body.appendChild(img);
  }

  function onLogoClick() { // Formerly redircted to home page, but function serves to redirect directly to role page for efficiency
    try {
      var role = localStorage.getItem('sbRole');
      var token = (typeof getAccessToken === 'function') ? getAccessToken() : localStorage.getItem('sbAccessToken');
      if (role && token) {
        var r = role.toLowerCase();
        if (r === 'doctor') { window.location.href = 'doctor.html'; return; }
        if (r === 'administrator') { window.location.href = 'admin.html'; return; }
        window.location.href = 'patient.html'; return;
      }
      // If no cached role but session exists, resolve role directly
      if (typeof supabaseRequest === 'function' && typeof getEmail === 'function') {
        var email = getEmail();
        if (token && email) {
          supabaseRequest({
            method: 'GET',
            path: 'user_accounts',
            accessToken: token,
            query: `?select=role,email&email=eq.${encodeURIComponent(email)}&limit=1`
          }).then(function(rows){
            var rr = (rows && rows[0] && rows[0].role) || 'patient';
            try { localStorage.setItem('sbRole', rr); } catch (_) {}
            rr = rr.toLowerCase();
            if (rr === 'doctor') { window.location.href = 'doctor.html'; return; }
            if (rr === 'administrator') { window.location.href = 'admin.html'; return; }
            window.location.href = 'patient.html';
          }).catch(function(){ window.location.href = 'home.html'; });
          return;
        }
      }
    } catch (_) {}
    window.location.href = "home.html";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureLogo);
  } else {
    ensureLogo();
  }
})();
