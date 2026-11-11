
apiGet('auth').catch(() => {
    if (!location.pathname.endsWith('/login.html')) location.replace(new URL('login.html', document.baseURI));
});
