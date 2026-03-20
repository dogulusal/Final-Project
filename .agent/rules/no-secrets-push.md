# Gizli Bilgileri (Secrets) Pushlama Kuralı

- **ASLA** `.env` dosyasını, API anahtarlarını, şifreleri, token'ları veya diğer hassas/gizli bilgileri içeren dosyaları Git repository'sine (veya herhangi bir uzak sunucuya) pushlama.
- Herhangi bir push işlemi öncesinde mutlaka staging area'yı (git status) kontrol et ve gizli bilgilerin yanlışlıkla commitlenmediğinden, `git push` komutunun içinde şifre içeren parametreler olmadığından emin ol.
- Bu kural **KESİN** bir kuraldır ve hiçbir şartta (benden izin alınmadan dahi) atlanamaz.
