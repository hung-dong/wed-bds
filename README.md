# Nha Dat Viet

Website dang tin bat dong san co:

- Trang public xem tin dang
- Ban do tuong tac trong chi tiet tin
- Trang quan tri dang nhap admin
- Backend Node luu du lieu that bang JSON
- Form khach de lai so dien thoai, luu vao `data/leads.json`
- Trang thanh vien gui tin cho duyet: `submit.html`, luu vao `data/submissions.json`
- Admin duyet hoac tu choi tin thanh vien truoc khi hien thi cong khai
- PWA co manifest/service worker de cai nhu ung dung web
- Link chia se rieng tung tin bang `#ma-tin`
- JSON-LD Schema.org cho du lieu tin dang

## Chay local

```powershell
npm start
```

Sau do mo:

- `http://localhost:3000`
- `http://localhost:3000/admin.html`

## Tai khoan mac dinh

- User: `admin`
- Password: `Admin@123456`

Truoc khi dua len mang, nen doi bang bien moi truong:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="MatKhauMoiRatManh"
$env:SESSION_SECRET="mot-chuoi-bi-mat-dai-va-kho-doan"
npm start
```

## Du lieu

- Tin dang: `data/listings.json`
- Thong tin website: `data/site.json`

Ban co the quan ly du lieu bang trang admin, khong can sua tay file JSON.
