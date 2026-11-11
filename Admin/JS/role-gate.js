(() => {
    const script = document.currentScript;
    const expectedRole = normalizeRole(script?.dataset.requiredRole || "");
    const authUrl = new URL("../Api/auth/login.php", script?.src || location.href);
    const loginUrl = new URL("../login.html", script?.src || location.href);

    function normalizeRole(role) {
        const normalized = String(role).trim().toLowerCase().replace(/[\s_-]+/g, " ");
        if (normalized === "administrator") return "admin";
        if (normalized === "sale staff") return "sales staff";
        return normalized;
    }

    async function checkRole() {
        if (!expectedRole) {
            console.error("Role gate is missing its required role.");
            location.replace(loginUrl.href);
            return;
        }

        try {
            const response = await fetch(authUrl, {
                headers: { Accept: "application/json" },
                credentials: "same-origin"
            });
            const state = await response.json();
            if (!response.ok || !state.authenticated) {
                location.replace(loginUrl.href);
                return;
            }
            if (normalizeRole(state.user?.role || "") !== expectedRole) {
                location.replace(loginUrl.href);
            }
        } catch (error) {
            console.error("Could not verify workspace access.", error);
            location.replace(loginUrl.href);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkRole, { once: true });
    } else {
        checkRole();
    }
})();
