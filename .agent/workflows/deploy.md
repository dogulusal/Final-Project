---
description: Build Docker image and deploy to Azure or self-hosted environment
---

1. Run pre-deploy checks
   - Verify all tests pass: `npm test`
   - Verify TypeScript compiles without errors: `npm run build`
   - Verify `.env` file has all required variables:
     - `MICROSOFT_APP_ID`, `MICROSOFT_APP_PASSWORD`
     - `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`, `POWERBI_TENANT_ID`
     - `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`
     - `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`

2. Build Docker image
   ```
   docker build -t teams-chatbot-backend:latest .
   ```

3. Test Docker container locally
   ```
   docker run --env-file .env -p 3978:3978 teams-chatbot-backend:latest
   ```
   - Verify health check: `curl http://localhost:3978/health`

4. Deploy based on target environment
   - **Azure App Service:**
     ```
     az acr login --name <registry-name>
     docker tag teams-chatbot-backend:latest <registry-name>.azurecr.io/teams-chatbot-backend:latest
     docker push <registry-name>.azurecr.io/teams-chatbot-backend:latest
     az webapp restart --name <app-name> --resource-group <rg-name>
     ```
   - **Self-Hosted:**
     ```
     docker-compose up -d
     ```
   - **Render.com (Free Tier):**
     - GitHub repo'yu Render Dashboard'a bağla → main branch push ile otomatik deploy
     - Veya Render Dashboard üzerinden "Manual Deploy" butonuna tıkla
     - Environment variables'ları Render Dashboard → Environment sekmesinden gir
     - Deploy sonrası Messaging Endpoint'i güncelle:
       Azure Portal → Bot Registration → Settings → Messaging Endpoint:
       `https://<render-service-name>.onrender.com/api/messages`

5. Post-deploy verification
   - Check health endpoint on production URL
   - Send a test message via Teams
   - Verify response received

6. Report
   - ✅ "Deploy successful. Bot is live."
   - ❌ "Deploy failed. Review errors."
