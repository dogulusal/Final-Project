---
description: Test the Teams chatbot bot locally and verify it responds correctly
---

1. Install dependencies
   ```
   cd teams-chatbot-backend && npm install
   ```

2. Build TypeScript
   ```
   npm run build
   ```

3. Start the bot locally
   ```
   npm run dev
   ```

4. Verify health check
   - Send a GET request to `http://localhost:3978/health`
   - Confirm all services show status:
     - `sql`: connected (or not_configured if local)
     - `powerbi_token`: valid
     - `status`: healthy (or degraded)

5. Test with Bot Framework Emulator (if available)
   - Open Bot Framework Emulator
   - Connect to `http://localhost:3978/api/messages`
   - Send a test message and verify response

6. Check logs
   - Verify no errors in terminal output
   - Confirm token manager initialized successfully
   - Confirm SQL connection pool ready

7. Report results
   - ✅ If all checks pass: "Bot is running and responding correctly."
   - ❌ If errors found: "Bot test failed. Review the errors above."
