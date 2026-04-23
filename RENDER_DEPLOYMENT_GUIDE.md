# Render Deployment Guide for CodeSync

## 🚀 Quick Deployment Steps

### 1. Connect GitHub Repository
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Select **"Connect GitHub repository"**
4. Choose **CodeSync** repository
5. Select **development-v2** branch

### 2. Configure Server Service

**Basic Settings:**
- **Name**: `code-sync-server`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Plan**: `Free`

**Build Settings:**
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

**Environment Variables:**
```bash
NODE_ENV=production
PORT=10000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
GROQ_API_KEY=your_groq_api_key
HUGGING_FACE_API_KEY=your_hugging_face_api_key
PISTON_URL=https://emkc.org/api/v2/piston
JUDGE0_URL=https://api.judge0.com/cebin/v1
```

### 3. Configure Client Service (Optional)

**For separate client deployment:**
- **Name**: `code-sync-client`
- **Root Directory**: `client`
- **Runtime**: `Static`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`

### 4. MongoDB Setup

**Option A: Render MongoDB**
1. In Render dashboard, go to **"New +"** → **"MongoDB"**
2. Create new MongoDB instance
3. Copy the connection string
4. Add to environment variables as `MONGO_URI`

**Option B: External MongoDB**
```bash
# Use MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/codesync?retryWrites=true&w=majority
```

### 5. Auto-Deploy Settings

**Enable Auto-Deploy:**
1. In service settings → **"Auto-Deploy"**
2. Select **development-v2** branch
3. Enable **"Deploy on push"**

### 6. Troubleshooting

**Common Issues & Solutions:**

**Issue: Build Failed**
```bash
# Check if TypeScript compiles
cd server
npm run build

# Check dist folder exists
ls -la dist/
```

**Issue: Port Binding Error**
```bash
# Use Render's port
PORT=10000  # Render provides this
```

**Issue: Database Connection**
```bash
# Check MongoDB URI format
MONGO_URI=mongodb://localhost:27017/test  # Local
MONGO_URI=mongodb+srv://...  # Atlas
```

**Issue: Environment Variables Not Working**
```bash
# Add to server.ts
require('dotenv').config()
console.log('MONGO_URI:', process.env.MONGO_URI)
```

### 7. Verify Deployment

**Health Check:**
```bash
# Test API endpoints
curl https://your-app.onrender.com/api/runtimes
curl https://your-app.onrender.com/health
```

**Load Testing:**
- Open multiple browser tabs
- Test real-time collaboration
- Verify WebSocket connections

### 8. Custom Domain (Optional)

**Add Custom Domain:**
1. Service settings → **"Custom Domains"**
2. Add your domain: `codesync.yourdomain.com`
3. Update DNS records as instructed

### 9. Monitoring

**Render Logs:**
- Service → **"Logs"** tab
- Check for errors and warnings
- Monitor WebSocket connections

### 10. Performance Optimization

**Free Plan Limits:**
- 750 hours/month
- 512MB RAM
- Shared CPU

**Optimization Tips:**
- Use production build
- Enable compression
- Optimize database queries
- Monitor memory usage

---

## 🎯 Production Checklist

**Before Going Live:**
- [ ] All environment variables set
- [ ] Database connected
- [ ] WebSocket working
- [ ] Code execution working
- [ ] AI suggestions working
- [ ] HTTPS enabled
- [ ] Custom domain configured
- [ ] Monitoring set up

**After Deployment:**
- [ ] Test all features
- [ ] Monitor logs
- [ ] Check performance
- [ ] Update documentation

---

## 🆘 Support

**Render Documentation:** https://render.com/docs/
**MongoDB Atlas:** https://www.mongodb.com/atlas
**GitHub Repository:** https://github.com/Rohit-masu/CodeSync

---

**🚀 Your CodeSync is now ready for production deployment on Render!**
