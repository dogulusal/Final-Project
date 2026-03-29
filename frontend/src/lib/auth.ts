/**
 * Frontend Auth Helpers — Token management ve API interceptors
 */

/**
 * Token'ı localStorage'dan al
 */
export const getAccessToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
};

/**
 * Refresh token'ı localStorage'dan al
 */
export const getRefreshToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
};

/**
 * Token'ları kaydet
 */
export const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
};

/**
 * Token'ları sil (logout)
 */
export const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
};

/**
 * Kullanıcı login'li mi kontrol et
 */
export const isLoggedIn = (): boolean => {
    return !!getAccessToken();
};

/**
 * JWT decode (simple — production'da library kullan)
 */
export const decodeToken = (token: string) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const decoded = JSON.parse(
            decodeURIComponent(
                atob(parts[1])
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            )
        );
        return decoded;
    } catch (e) {
        return null;
    }
};

/**
 * Token süresi dolmuş mu kontrol et
 */
export const isTokenExpired = (token: string): boolean => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
};

/**
 * Fetch wrapper — Authorization header'ı otomatik ekle
 */
export const apiFetch = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    const accessToken = getAccessToken();

    if (!accessToken) {
        // Token yoksa normal fetch yap (public endpoint'ler için)
        return fetch(url, options);
    }

    if (isTokenExpired(accessToken)) {
        // Token süresi dolmuşsa logout yap
        clearTokens();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        throw new Error('Token süresi dolmuştur. Lütfen tekrar giriş yapınız.');
    }

    // Authorization header ekle
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
    };

    return fetch(url, { ...options, headers });
};
