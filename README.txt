YeYuShiJie project package

Backend:
1. Install Java 21 or newer.
2. Run `start-backend.bat`.
3. The API runs at `http://localhost:8080`.

Frontend:
1. Install Python 3.
2. Run `start-frontend.bat`.
3. Open `http://localhost:5173/login.html`.

Start both:
1. Run `start-all.bat`.

Roles:
- `USER`: public site
- `ADMIN`: admin console

Built-in admin:
- Username: `admin`
- Password: `admin123456`

Notes:
- Frontend and backend are separated.
- Backend root is only for the API service.
- Frontend files are in the `frontend` folder and use CORS to access the backend.
- Configure `BAIDU_API_KEY` and `BAIDU_SECRET_KEY` to improve recognition quality.
