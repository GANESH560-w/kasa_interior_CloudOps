require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { getPool, query } = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const uploadsDir = path.join(process.cwd(), "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(process.cwd()));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({ storage });

function makeId(prefix) {
    return `${prefix}-${Date.now()}${crypto.randomInt(100, 999)}`;
}

function signToken(admin) {
    return jwt.sign(
        {
            sub: admin.id,
            username: admin.username,
            name: admin.name
        },
        JWT_SECRET,
        { expiresIn: "12h" }
    );
}

function auth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
        return res.status(401).json({ message: "Authentication required." });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Session expired. Please log in again." });
    }
}

function toNumber(value) {
    return Number(value || 0);
}

function mapEnquiry(row) {
    return {
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        phone: row.phone,
        email: row.email,
        service: row.service,
        message: row.message,
        status: row.status,
        unread: Boolean(row.unread)
    };
}

function mapCustomer(row) {
    return {
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        city: row.city,
        notes: row.notes
    };
}

function mapContractor(row) {
    return {
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        specialty: row.specialty,
        phone: row.phone,
        email: row.email,
        bank: row.bank_details,
        notes: row.notes
    };
}

function mapProject(row) {
    return {
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        client: row.client,
        type: row.type,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        budget: toNumber(row.budget),
        paid: toNumber(row.paid),
        address: row.address,
        notes: row.notes,
        contractors: row.contractors
    };
}

function mapTimeline(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        date: row.entry_date,
        createdAt: row.created_at,
        kind: row.kind,
        text: row.text
    };
}

function mapExpense(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        item: row.item,
        category: row.category,
        amount: toNumber(row.amount),
        date: row.expense_date,
        by: row.added_by,
        notes: row.notes
    };
}

function mapBill(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        contractor: row.contractor,
        work: row.work,
        amount: toNumber(row.amount),
        date: row.bill_date,
        dueDate: row.due_date,
        status: row.status,
        paidAmount: toNumber(row.paid_amount),
        paidDate: row.paid_date
    };
}

function mapDocument(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        fileName: row.file_name,
        filePath: row.file_path,
        fileUrl: `/${row.file_path.replace(/\\/g, "/")}`,
        type: row.type,
        by: row.uploaded_by,
        date: row.created_at
    };
}

async function refreshProjectPaidAmount(projectId) {
    const totals = await query(
        "SELECT COALESCE(SUM(paid_amount), 0) AS totalPaid FROM bills WHERE project_id = ?",
        [projectId]
    );
    const totalPaid = toNumber(totals[0]?.totalPaid);
    await query("UPDATE projects SET paid = ? WHERE id = ?", [totalPaid, projectId]);
    return totalPaid;
}

async function ensureSchema() {
    await query(`
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(120) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS enquiries (
            id VARCHAR(40) PRIMARY KEY,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(40) NOT NULL,
            email VARCHAR(160) NOT NULL,
            service VARCHAR(120) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'New',
            unread TINYINT(1) NOT NULL DEFAULT 1
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS customers (
            id VARCHAR(40) PRIMARY KEY,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(40) NOT NULL,
            email VARCHAR(160) NULL,
            address VARCHAR(255) NULL,
            city VARCHAR(120) NULL,
            notes TEXT NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS contractors (
            id VARCHAR(40) PRIMARY KEY,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            name VARCHAR(120) NOT NULL,
            specialty VARCHAR(120) NOT NULL,
            phone VARCHAR(40) NOT NULL,
            email VARCHAR(160) NULL,
            bank_details VARCHAR(255) NULL,
            notes TEXT NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS projects (
            id VARCHAR(40) PRIMARY KEY,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            name VARCHAR(160) NOT NULL,
            client VARCHAR(120) NOT NULL,
            type VARCHAR(120) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status VARCHAR(40) NOT NULL,
            budget DECIMAL(12, 2) NOT NULL DEFAULT 0,
            paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
            address VARCHAR(255) NULL,
            notes TEXT NULL,
            contractors TEXT NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS timeline_entries (
            id VARCHAR(40) PRIMARY KEY,
            project_id VARCHAR(40) NOT NULL,
            entry_date DATE NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            kind VARCHAR(40) NOT NULL,
            text TEXT NOT NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(40) PRIMARY KEY,
            project_id VARCHAR(40) NOT NULL,
            item VARCHAR(160) NOT NULL,
            category VARCHAR(80) NOT NULL,
            amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
            expense_date DATE NOT NULL,
            added_by VARCHAR(120) NOT NULL,
            notes TEXT NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS bills (
            id VARCHAR(40) PRIMARY KEY,
            project_id VARCHAR(40) NOT NULL,
            contractor VARCHAR(120) NOT NULL,
            work VARCHAR(255) NOT NULL,
            amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
            bill_date DATE NOT NULL,
            due_date DATE NOT NULL,
            status VARCHAR(40) NOT NULL,
            paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
            paid_date DATE NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS documents (
            id VARCHAR(40) PRIMARY KEY,
            project_id VARCHAR(40) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            type VARCHAR(80) NOT NULL,
            uploaded_by VARCHAR(120) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const admins = await query("SELECT COUNT(*) AS total FROM admins");
    if (!admins[0]?.total) {
        const username = process.env.ADMIN_USERNAME || "kasaadmin";
        const password = process.env.ADMIN_PASSWORD || "kasa@2025";
        const name = process.env.ADMIN_NAME || "Kasa Admin";
        const passwordHash = await bcrypt.hash(password, 10);
        await query(
            "INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)",
            [username, passwordHash, name]
        );
        console.log(`Seeded admin user: ${username}`);
    }
}

async function fetchBootstrap() {
    const [enquiries, customers, contractors, projects, timeline, expenses, bills, documents] = await Promise.all([
        query("SELECT * FROM enquiries ORDER BY created_at DESC"),
        query("SELECT * FROM customers ORDER BY created_at DESC"),
        query("SELECT * FROM contractors ORDER BY created_at DESC"),
        query("SELECT * FROM projects ORDER BY created_at DESC"),
        query("SELECT * FROM timeline_entries ORDER BY created_at DESC"),
        query("SELECT * FROM expenses ORDER BY expense_date DESC"),
        query("SELECT * FROM bills ORDER BY bill_date DESC"),
        query("SELECT * FROM documents ORDER BY created_at DESC")
    ]);

    return {
        enquiries: enquiries.map(mapEnquiry),
        customers: customers.map(mapCustomer),
        contractors: contractors.map(mapContractor),
        projects: projects.map(mapProject),
        timeline: timeline.map(mapTimeline),
        expenses: expenses.map(mapExpense),
        bills: bills.map(mapBill),
        documents: documents.map(mapDocument)
    };
}

app.get("/api/health", async (_req, res) => {
    try {
        await getPool().query("SELECT 1");
        res.json({ status: "ok" });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

app.post("/api/public/enquiries", async (req, res) => {
    const { fullName, phone, email, service, message } = req.body;

    if (!fullName || !phone || !email || !service || !message) {
        return res.status(400).json({ message: "All enquiry fields are required." });
    }

    const enquiry = {
        id: makeId("ENQ"),
        name: String(fullName).trim(),
        phone: String(phone).trim(),
        email: String(email).trim(),
        service: String(service).trim(),
        message: String(message).trim(),
        status: "New",
        unread: 1
    };

    await query(
        `INSERT INTO enquiries (id, name, phone, email, service, message, status, unread)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [enquiry.id, enquiry.name, enquiry.phone, enquiry.email, enquiry.service, enquiry.message, enquiry.status, enquiry.unread]
    );

    return res.status(201).json({ message: "Enquiry submitted successfully." });
});

app.post("/api/auth/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    const rows = await query("SELECT * FROM admins WHERE username = ? LIMIT 1", [username]);
    const admin = rows[0];

    if (!admin) {
        return res.status(401).json({ message: "Invalid username or password." });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
        return res.status(401).json({ message: "Invalid username or password." });
    }

    return res.json({
        token: signToken(admin),
        user: {
            id: admin.id,
            username: admin.username,
            name: admin.name
        }
    });
});

app.get("/api/auth/me", auth, (req, res) => {
    res.json({ user: req.user });
});

app.get("/api/admin/bootstrap", auth, async (_req, res) => {
    res.json(await fetchBootstrap());
});

app.post("/api/admin/customers", auth, async (req, res) => {
    const customer = {
        id: makeId("CUS"),
        name: String(req.body.name || "").trim(),
        phone: String(req.body.phone || "").trim(),
        email: String(req.body.email || "").trim(),
        address: String(req.body.address || "").trim(),
        city: String(req.body.city || "").trim(),
        notes: String(req.body.notes || "").trim()
    };

    await query(
        `INSERT INTO customers (id, name, phone, email, address, city, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [customer.id, customer.name, customer.phone, customer.email || null, customer.address || null, customer.city || null, customer.notes || null]
    );

    const rows = await query("SELECT * FROM customers WHERE id = ?", [customer.id]);
    res.status(201).json(mapCustomer(rows[0]));
});

app.delete("/api/admin/customers/:id", auth, async (req, res) => {
    await query("DELETE FROM customers WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
});

app.post("/api/admin/contractors", auth, async (req, res) => {
    const contractor = {
        id: makeId("CON"),
        name: String(req.body.name || "").trim(),
        specialty: String(req.body.specialty || "").trim(),
        phone: String(req.body.phone || "").trim(),
        email: String(req.body.email || "").trim(),
        bank: String(req.body.bank || "").trim(),
        notes: String(req.body.notes || "").trim()
    };

    await query(
        `INSERT INTO contractors (id, name, specialty, phone, email, bank_details, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [contractor.id, contractor.name, contractor.specialty, contractor.phone, contractor.email || null, contractor.bank || null, contractor.notes || null]
    );

    const rows = await query("SELECT * FROM contractors WHERE id = ?", [contractor.id]);
    res.status(201).json(mapContractor(rows[0]));
});

app.delete("/api/admin/contractors/:id", auth, async (req, res) => {
    await query("DELETE FROM contractors WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
});

app.post("/api/admin/projects", auth, async (req, res) => {
    const project = {
        id: makeId("PRJ"),
        name: String(req.body.name || "").trim(),
        client: String(req.body.client || "").trim(),
        type: String(req.body.type || "").trim(),
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: String(req.body.status || "Planning").trim(),
        budget: toNumber(req.body.budget),
        address: String(req.body.address || "").trim(),
        notes: String(req.body.notes || "").trim(),
        contractors: String(req.body.contractors || "").trim()
    };

    await query(
        `INSERT INTO projects (id, name, client, type, start_date, end_date, status, budget, paid, address, notes, contractors)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [project.id, project.name, project.client, project.type, project.startDate, project.endDate, project.status, project.budget, project.address || null, project.notes || null, project.contractors || null]
    );

    const rows = await query("SELECT * FROM projects WHERE id = ?", [project.id]);
    res.status(201).json(mapProject(rows[0]));
});

app.delete("/api/admin/projects/:id", auth, async (req, res) => {
    const { id } = req.params;
    const docs = await query("SELECT * FROM documents WHERE project_id = ?", [id]);
    docs.forEach(doc => {
        const absolute = path.join(process.cwd(), doc.file_path);
        if (fs.existsSync(absolute)) {
            fs.unlinkSync(absolute);
        }
    });
    await query("DELETE FROM timeline_entries WHERE project_id = ?", [id]);
    await query("DELETE FROM expenses WHERE project_id = ?", [id]);
    await query("DELETE FROM bills WHERE project_id = ?", [id]);
    await query("DELETE FROM documents WHERE project_id = ?", [id]);
    await query("DELETE FROM projects WHERE id = ?", [id]);
    res.json({ ok: true });
});

app.patch("/api/admin/enquiries/:id", auth, async (req, res) => {
    const currentRows = await query("SELECT * FROM enquiries WHERE id = ?", [req.params.id]);
    const current = currentRows[0];
    if (!current) {
        return res.status(404).json({ message: "Enquiry not found." });
    }

    const nextStatus = req.body.status ?? current.status;
    const nextUnread = req.body.unread ?? current.unread;

    await query(
        "UPDATE enquiries SET status = ?, unread = ? WHERE id = ?",
        [nextStatus, nextUnread ? 1 : 0, req.params.id]
    );

    const rows = await query("SELECT * FROM enquiries WHERE id = ?", [req.params.id]);
    res.json(mapEnquiry(rows[0]));
});

app.delete("/api/admin/enquiries/:id", auth, async (req, res) => {
    await query("DELETE FROM enquiries WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
});

app.post("/api/admin/projects/:id/timeline", auth, async (req, res) => {
    const entry = {
        id: makeId("TL"),
        projectId: req.params.id,
        date: req.body.date,
        kind: String(req.body.kind || "Note").trim(),
        text: String(req.body.text || "").trim()
    };

    await query(
        "INSERT INTO timeline_entries (id, project_id, entry_date, kind, text) VALUES (?, ?, ?, ?, ?)",
        [entry.id, entry.projectId, entry.date, entry.kind, entry.text]
    );

    const rows = await query("SELECT * FROM timeline_entries WHERE id = ?", [entry.id]);
    res.status(201).json(mapTimeline(rows[0]));
});

app.post("/api/admin/projects/:id/expenses", auth, async (req, res) => {
    const expense = {
        id: makeId("EXP"),
        projectId: req.params.id,
        item: String(req.body.item || "").trim(),
        category: String(req.body.category || "").trim(),
        amount: toNumber(req.body.amount),
        date: req.body.date,
        by: String(req.body.by || "").trim(),
        notes: String(req.body.notes || "").trim()
    };

    await query(
        `INSERT INTO expenses (id, project_id, item, category, amount, expense_date, added_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [expense.id, expense.projectId, expense.item, expense.category, expense.amount, expense.date, expense.by, expense.notes || null]
    );

    const rows = await query("SELECT * FROM expenses WHERE id = ?", [expense.id]);
    res.status(201).json(mapExpense(rows[0]));
});

app.post("/api/admin/projects/:id/bills", auth, async (req, res) => {
    const bill = {
        id: makeId("BIL"),
        projectId: req.params.id,
        contractor: String(req.body.contractor || "").trim(),
        work: String(req.body.work || "").trim(),
        amount: toNumber(req.body.amount),
        date: req.body.date,
        dueDate: req.body.dueDate,
        status: String(req.body.status || "Pending").trim()
    };

    await query(
        `INSERT INTO bills (id, project_id, contractor, work, amount, bill_date, due_date, status, paid_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [bill.id, bill.projectId, bill.contractor, bill.work, bill.amount, bill.date, bill.dueDate, bill.status]
    );

    await refreshProjectPaidAmount(bill.projectId);
    const rows = await query("SELECT * FROM bills WHERE id = ?", [bill.id]);
    res.status(201).json(mapBill(rows[0]));
});

app.post("/api/admin/bills/:id/pay", auth, async (req, res) => {
    const amount = toNumber(req.body.amount);
    const paidDate = req.body.paidDate;
    const rows = await query("SELECT * FROM bills WHERE id = ?", [req.params.id]);
    const bill = rows[0];

    if (!bill) {
        return res.status(404).json({ message: "Bill not found." });
    }

    const nextPaid = toNumber(bill.paid_amount) + amount;
    const nextStatus = nextPaid >= toNumber(bill.amount) ? "Paid" : "Partial";

    await query(
        "UPDATE bills SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?",
        [nextPaid, paidDate, nextStatus, req.params.id]
    );

    await refreshProjectPaidAmount(bill.project_id);

    const updatedRows = await query("SELECT * FROM bills WHERE id = ?", [req.params.id]);
    res.json(mapBill(updatedRows[0]));
});

app.post("/api/admin/projects/:id/documents", auth, upload.single("fileUpload"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "Document file is required." });
    }

    const document = {
        id: makeId("DOC"),
        projectId: req.params.id,
        fileName: req.file.originalname,
        filePath: path.join("uploads", req.file.filename),
        type: String(req.body.type || "Other").trim(),
        by: String(req.body.by || "").trim()
    };

    await query(
        `INSERT INTO documents (id, project_id, file_name, file_path, type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [document.id, document.projectId, document.fileName, document.filePath, document.type, document.by]
    );

    const rows = await query("SELECT * FROM documents WHERE id = ?", [document.id]);
    res.status(201).json(mapDocument(rows[0]));
});

app.delete("/api/admin/documents/:id", auth, async (req, res) => {
    const rows = await query("SELECT * FROM documents WHERE id = ?", [req.params.id]);
    const doc = rows[0];

    if (doc) {
        const absolute = path.join(process.cwd(), doc.file_path);
        if (fs.existsSync(absolute)) {
            fs.unlinkSync(absolute);
        }
        await query("DELETE FROM documents WHERE id = ?", [req.params.id]);
    }

    res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: "Server error", detail: err.message });
});

app.get(["/admin", "/admin/"], (_req, res) => {
    res.redirect("/admin/index.html");
});

app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return next();
    }

    const target = req.path === "/" ? "index.html" : req.path.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), target);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }

    return res.status(404).sendFile(path.join(process.cwd(), "index.html"));
});

async function start() {
    try {
        await getPool().query("SELECT 1");
        await ensureSchema();
        app.listen(PORT, () => {
            console.log(`Kasa Interiors server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

start();
