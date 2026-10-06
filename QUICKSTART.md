# Quick Start Commands

## Setup
```bash
cd thiduaclass
npm install
```

## Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Scripts
```bash
# Tạo admin
node scripts/create-admin.js admin@x.com Admin123! "Admin Name"

# Test connection
node scripts/test-connection.js

# Import học sinh (sau khi upload queue trên web)
node scripts/import-students.js
```

## Firebase
```bash
firebase login
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

## Admin Panel
- Development: http://localhost:5173/admin
- Production: https://your-domain.com/admin

## Important Files
- `scripts/service-account.json` - Service Account Key (gitignore, tải từ Firebase Console)
- `.env.local` - Firebase config (gitignore)
- `firestore.rules` - Firestore security rules

## Documentation
- ADMIN_SETUP.md - Setup hệ thống admin
- docs/IMPORT_GUIDE.md - Hướng dẫn import học sinh chi tiết
- README.md - Tổng quan dự án
