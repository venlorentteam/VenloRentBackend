# NewProjectBackend

## Demo admin seed

If you want a ready-made `admins` collection for MongoDB Compass, run:

```bash
npm run seed:admin-demo
```

This creates three demo admin documents in the `admins` collection with hashed passwords, so they work with the existing `/admin/login` route.

Demo credentials:

- `superadmin@example.com` / `Admin123!`
- `admin@example.com` / `Admin123!`
- `moderator@example.com` / `Admin123!`

You can then open MongoDB Compass and edit those documents however you like.
The Backend for the Venlorent which should contain routes and API calls
