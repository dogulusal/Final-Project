import { prisma } from '../../config/database';
import { comparePassword } from '../../common/auth';

/**
 * Login service — user doğrulama ve token generation hazırlığı
 */
export class AuthService {
    /**
     * Email ve şifreyle kullanıcı doğrula
     */
    static async login(email: string, sifre: string) {
        // Kullanıcı DB'den bul
        const user = await prisma.kullanici.findFirst({
            where: {
                email: email.toLowerCase()
            }
        });

        if (!user) {
            throw new Error('Kullanıcı bulunamadı');
        }

        // Şifre kontrol et
        const isValidPassword = await comparePassword(sifre, user.sifreHash);
        if (!isValidPassword) {
            throw new Error('Hatalı şifre');
        }

        // Başarılı — user bilgilerini return et
        return {
            id: user.id,
            email: user.email,
            ad: user.ad,
            role: 'admin' // Şimdlik sabit admin (future: role field eklenebilir)
        };
    }

    /**
     * Kullanıcı var mı kontrol et (signup için)
     */
    static async userExists(email: string): Promise<boolean> {
        const user = await prisma.kullanici.findFirst({
            where: { email: email.toLowerCase() }
        });
        return !!user;
    }
}
