const STORAGE = { auth: "kasa_admin_token" };
const charts = {};
const state = { enquiries: [], projects: [], customers: [], contractors: [], timeline: [], expenses: [], bills: [], documents: [] };

document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.adminPage;

    if (page === "login") {
        initLoginPage();
        return;
    }

    if (!isAuthed()) {
        window.location.href = "index.html";
        return;
    }

    try {
        await loadBootstrap();
    } catch (error) {
        if (error.status === 401) {
            clearToken();
            window.location.href = "index.html";
            return;
        }
        toast(error.message || "Could not load dashboard data.");
        return;
    }

    renderSidebar(page);
    bindLogout();

    if (page === "dashboard") initDashboard();
    if (page === "enquiries") initEnquiries();
    if (page === "projects") initProjects();
    if (page === "project-detail") initProjectDetail();
    if (page === "customers") initCustomers();
    if (page === "contractors") initContractors();
    if (page === "reports") initReports();
});

async function loadBootstrap() {
    const data = await api("/api/admin/bootstrap");
    Object.keys(state).forEach(key => {
        state[key] = Array.isArray(data[key]) ? data[key] : [];
    });
}

function initLoginPage() {
    if (isAuthed()) {
        window.location.href = "dashboard.html";
        return;
    }

    const form = document.getElementById("adminLoginForm");
    const error = document.getElementById("loginError");

    form?.addEventListener("submit", async event => {
        event.preventDefault();

        try {
            const response = await api("/api/auth/login", {
                method: "POST",
                body: {
                    username: document.getElementById("username").value.trim(),
                    password: document.getElementById("password").value.trim()
                },
                auth: false
            });
            localStorage.setItem(STORAGE.auth, response.token);
            window.location.href = "dashboard.html";
        } catch (err) {
            if (error) error.textContent = err.message || "Invalid username or password";
        }
    });
}

function initDashboard() {
    const projects = load("projects");
    const enquiries = load("enquiries");
    const bills = load("bills");

    const metrics = [
        { label: "Total Active Projects", value: projects.filter(project => project.status !== "Completed").length },
        { label: "New Enquiries", value: enquiries.filter(enquiry => enquiry.status === "New").length },
        { label: "Total Revenue (INR)", value: Number(projects.reduce((sum, project) => sum + Number(project.budget || 0), 0)).toLocaleString("en-IN") },
        { label: "Pending Bills", value: bills.filter(bill => bill.status !== "Paid").length }
    ];

    document.getElementById("metricCards").innerHTML = metrics.map(metric => `
        <article class="metric-card">
            <p class="metric-label">${metric.label}</p>
            <p class="metric-value">${metric.value}</p>
        </article>
    `).join("");

    const recentEnquiries = [...enquiries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    renderSimpleTable("dashboardEnquiriesTable", ["Customer Name", "Service", "Date", "Status"], recentEnquiries.map(enquiry => [
        enquiry.name,
        enquiry.service,
        fmtDate(enquiry.createdAt),
        badge(enquiry.status)
    ]));

    const activeProjects = projects.filter(project => project.status !== "Completed").slice(0, 5);
    document.getElementById("dashboardProjects").innerHTML = activeProjects.length ? activeProjects.map(project => `
        <div class="detail-card" style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <strong>${escapeHtml(project.name)}</strong>
                <span>${badge(project.status)}</span>
            </div>
            <div class="progress"><span style="width:${projectProgress(project)}%"></span></div>
        </div>
    `).join("") : `<div class="empty-state">No active projects available.</div>`;

    const recentBills = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    renderSimpleTable("dashboardBillsTable", ["Contractor", "Work Done", "Bill Amount", "Status"], recentBills.map(bill => [
        bill.contractor,
        bill.work,
        rupee(bill.amount),
        badge(bill.status)
    ]));

    const thisMonthEnquiries = enquiries.filter(enquiry => isInCurrentMonth(enquiry.createdAt)).length;
    const thisMonthRevenue = projects.filter(project => isInCurrentMonth(project.startDate)).reduce((sum, project) => sum + Number(project.budget || 0), 0);
    document.getElementById("dashboardQuickStats").innerHTML = `
        <p>This month's enquiries: <strong>${thisMonthEnquiries}</strong></p>
        <p>This month's revenue: <strong>${rupee(thisMonthRevenue)}</strong></p>
    `;
}

function initEnquiries() {
    const searchInput = document.getElementById("enquirySearch");
    const table = document.getElementById("enquiriesTable");
    const pagination = document.getElementById("enquiriesPagination");
    const sortState = { key: "createdAt", direction: "desc" };
    const pageState = { current: 1, size: 10 };

    const draw = () => {
        let enquiries = [...load("enquiries")];
        const query = (searchInput.value || "").toLowerCase();

        if (query) enquiries = enquiries.filter(enquiry => [enquiry.name, enquiry.email, enquiry.phone, enquiry.createdAt].join(" ").toLowerCase().includes(query));

        enquiries = sortRecords(enquiries, sortState);
        const paged = paginate(enquiries, pageState);

        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="createdAt">Date & Time</th>
                    <th data-sort="name">Name</th>
                    <th data-sort="phone">Phone</th>
                    <th data-sort="email">Email</th>
                    <th data-sort="service">Service</th>
                    <th>Message</th>
                    <th data-sort="status">Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${paged.items.map(enquiry => `
                    <tr class="${enquiry.unread ? "unread" : ""} enquiry-row" data-id="${enquiry.id}">
                        <td>${fmtDate(enquiry.createdAt)}</td>
                        <td>${escapeHtml(enquiry.name)}</td>
                        <td>${escapeHtml(enquiry.phone)}</td>
                        <td>${escapeHtml(enquiry.email)}</td>
                        <td>${escapeHtml(enquiry.service)}</td>
                        <td><button class="btn alt view-msg" data-id="${enquiry.id}">Open</button></td>
                        <td>
                            <select class="status-select" data-id="${enquiry.id}">
                                ${["New", "Contacted", "In Progress", "Closed"].map(status => `<option value="${status}" ${status === enquiry.status ? "selected" : ""}>${status}</option>`).join("")}
                            </select>
                        </td>
                        <td><button class="btn danger delete-enquiry" data-id="${enquiry.id}">Delete</button></td>
                    </tr>
                    <tr data-message-row="${enquiry.id}" style="display:none;">
                        <td colspan="8">${escapeHtml(enquiry.message || "")}</td>
                    </tr>
                `).join("") || `<tr><td colspan="8" class="empty-state">No enquiries found.</td></tr>`}
            </tbody>
        `;

        attachSortableHeaders(table, sortState, draw);
        attachPagination(pagination, paged.totalPages, pageState, draw);

        table.querySelectorAll(".view-msg").forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                const id = button.dataset.id;
                const row = table.querySelector(`[data-message-row="${id}"]`);
                if (!row) return;
                row.style.display = row.style.display === "none" ? "table-row" : "none";
                button.textContent = row.style.display === "none" ? "Open" : "Close";
                if (row.style.display !== "none") await updateEnquiry(id, { unread: false });
            });
        });

        table.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", async () => {
                await updateEnquiry(select.dataset.id, { status: select.value, unread: false });
                toast("Updated");
                draw();
            });
        });

        table.querySelectorAll(".delete-enquiry").forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                if (!window.confirm("Delete enquiry?")) return;
                await api(`/api/admin/enquiries/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE" });
                setCollection("enquiries", load("enquiries").filter(item => item.id !== button.dataset.id));
                toast("Deleted");
                draw();
            });
        });
    };

    searchInput.addEventListener("input", () => { pageState.current = 1; draw(); });
    document.getElementById("exportEnquiries").addEventListener("click", exportEnquiriesCSV);
    draw();
}
function initProjects() {
    const form = document.getElementById("projectForm");
    const searchInput = document.getElementById("projectSearch");
    const statusFilter = document.getElementById("projectStatusFilter");
    const clientFilter = document.getElementById("projectClientFilter");
    const startFilter = document.getElementById("projectStartFilter");
    const endFilter = document.getElementById("projectEndFilter");
    const clientInput = document.getElementById("projectClientInput");
    const table = document.getElementById("projectsTable");
    const pagination = document.getElementById("projectsPagination");
    const sortState = { key: "id", direction: "asc" };
    const pageState = { current: 1, size: 10 };

    const populateClientLists = () => {
        const customers = load("customers");
        const currentFilter = clientFilter.value;
        const options = customers.map(customer => `<option value="${escapeAttribute(customer.name)}">${escapeHtml(customer.name)}</option>`).join("");
        clientFilter.innerHTML = `<option value="">All Clients</option>${options}`;
        clientInput.innerHTML = `<option value="">Select Client</option>${options}`;
        clientFilter.value = customers.some(customer => customer.name === currentFilter) ? currentFilter : "";
    };

    const draw = () => {
        populateClientLists();
        let projects = [...load("projects")];
        const query = (searchInput.value || "").toLowerCase();

        if (query) projects = projects.filter(project => [project.name, project.client, project.type].join(" ").toLowerCase().includes(query));
        if (statusFilter.value) projects = projects.filter(project => project.status === statusFilter.value);
        if (clientFilter.value) projects = projects.filter(project => project.client === clientFilter.value);
        if (startFilter.value) projects = projects.filter(project => (project.startDate || "") >= startFilter.value);
        if (endFilter.value) projects = projects.filter(project => (project.endDate || "") <= endFilter.value);

        projects = sortRecords(projects, sortState);
        const paged = paginate(projects, pageState);

        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="id">Project ID</th>
                    <th data-sort="client">Client</th>
                    <th data-sort="type">Type</th>
                    <th data-sort="startDate">Start Date</th>
                    <th data-sort="endDate">End Date</th>
                    <th data-sort="status">Status</th>
                    <th data-sort="budget">Budget (INR)</th>
                    <th data-sort="paid">Paid (INR)</th>
                    <th>Balance (INR)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${paged.items.map(project => `
                    <tr>
                        <td>${project.id}</td>
                        <td>${escapeHtml(project.client)}</td>
                        <td>${escapeHtml(project.type)}</td>
                        <td>${simpleDate(project.startDate)}</td>
                        <td>${simpleDate(project.endDate)}</td>
                        <td>${badge(project.status)}</td>
                        <td>${rupee(project.budget)}</td>
                        <td>${rupee(project.paid || 0)}</td>
                        <td>${rupee(Number(project.budget || 0) - Number(project.paid || 0))}</td>
                        <td>
                            <a class="btn alt" href="project-detail.html?id=${encodeURIComponent(project.id)}">View</a>
                            <button class="btn danger delete-project" data-id="${project.id}">Delete</button>
                        </td>
                    </tr>
                `).join("") || `<tr><td colspan="10" class="empty-state">No projects found.</td></tr>`}
            </tbody>
        `;

        attachSortableHeaders(table, sortState, draw);
        attachPagination(pagination, paged.totalPages, pageState, draw);

        table.querySelectorAll(".delete-project").forEach(button => {
            button.addEventListener("click", async () => {
                if (!window.confirm("Delete project?")) return;
                const projectId = button.dataset.id;
                await api(`/api/admin/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
                setCollection("projects", load("projects").filter(item => item.id !== projectId));
                setCollection("timeline", load("timeline").filter(item => item.projectId !== projectId));
                setCollection("expenses", load("expenses").filter(item => item.projectId !== projectId));
                setCollection("bills", load("bills").filter(item => item.projectId !== projectId));
                setCollection("documents", load("documents").filter(item => item.projectId !== projectId));
                toast("Deleted");
                draw();
            });
        });
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        const created = await api("/api/admin/projects", { method: "POST", body: payload });
        upsertById("projects", created);
        toast("Saved");
        form.reset();
        draw();
    });

    [searchInput, statusFilter, clientFilter, startFilter, endFilter].forEach(input => {
        input.addEventListener("input", () => { pageState.current = 1; draw(); });
        input.addEventListener("change", () => { pageState.current = 1; draw(); });
    });

    draw();
}

function initProjectDetail() {
    const projectId = new URLSearchParams(window.location.search).get("id");
    const project = load("projects").find(item => item.id === projectId);
    const title = document.getElementById("projectDetailTitle");

    if (!project) {
        title.textContent = "Project Detail";
        document.querySelectorAll(".panel").forEach(panel => {
            panel.innerHTML = `<div class="empty-state">Project not found.</div>`;
        });
        return;
    }

    title.textContent = `${project.name} (${project.id})`;

    document.querySelectorAll(".tab-btn").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(item => item.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
        });
    });

    bindTimeline(projectId);
    bindExpenses(projectId);
    bindBills(projectId);
    bindDocuments(projectId);
    bindCustomerInfo(project);
}

function initCustomers() {
    const form = document.getElementById("customerForm");
    const searchInput = document.getElementById("customerSearch");
    const table = document.getElementById("customersTable");
    const pagination = document.getElementById("customersPagination");
    const detail = document.getElementById("customerDetailContent");
    const sortState = { key: "id", direction: "asc" };
    const pageState = { current: 1, size: 10 };

    const showCustomerDetail = customerId => {
        const customer = load("customers").find(item => item.id === customerId);
        if (!customer) return;

        const projects = load("projects").filter(project => project.client === customer.name);
        const enquiries = load("enquiries").filter(enquiry => enquiry.name === customer.name || enquiry.email === customer.email);
        const paymentHistory = projects.map(project => `<li>${escapeHtml(project.name)}: Paid ${rupee(project.paid || 0)} of ${rupee(project.budget || 0)}</li>`).join("") || "<li>No payment history yet.</li>";

        detail.innerHTML = `
            <div class="detail-card">
                <p><strong>Name:</strong> ${escapeHtml(customer.name)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(customer.phone)}</p>
                <p><strong>Email:</strong> ${escapeHtml(customer.email || "")}</p>
                <p><strong>Address:</strong> ${escapeHtml(customer.address || "")}</p>
                <p><strong>City:</strong> ${escapeHtml(customer.city || "")}</p>
                <p><strong>Notes:</strong> ${escapeHtml(customer.notes || "")}</p>
                <p><strong>Linked Projects:</strong></p>
                <ul>${projects.map(project => `<li>${escapeHtml(project.name)} - ${escapeHtml(project.status)}</li>`).join("") || "<li>No linked projects.</li>"}</ul>
                <p><strong>Enquiries:</strong></p>
                <ul>${enquiries.map(enquiry => `<li>${simpleDate(enquiry.createdAt)} - ${escapeHtml(enquiry.service)} - ${escapeHtml(enquiry.status)}</li>`).join("") || "<li>No enquiries found.</li>"}</ul>
                <p><strong>Payment History:</strong></p>
                <ul>${paymentHistory}</ul>
            </div>
        `;
    };

    const draw = () => {
        let customers = [...load("customers")];
        const projects = load("projects");
        const query = (searchInput.value || "").toLowerCase();

        if (query) customers = customers.filter(customer => [customer.name, customer.email, customer.city].join(" ").toLowerCase().includes(query));

        customers = customers.map(customer => {
            const linkedProjects = projects.filter(project => project.client === customer.name);
            return { ...customer, projectsCount: linkedProjects.length, revenue: linkedProjects.reduce((sum, project) => sum + Number(project.budget || 0), 0) };
        });

        customers = sortRecords(customers, sortState);
        const paged = paginate(customers, pageState);

        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="id">ID</th>
                    <th data-sort="name">Name</th>
                    <th data-sort="phone">Phone</th>
                    <th data-sort="email">Email</th>
                    <th data-sort="city">City</th>
                    <th data-sort="projectsCount">Projects</th>
                    <th data-sort="revenue">Total Revenue</th>
                    <th data-sort="createdAt">Date Added</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${paged.items.map(customer => `
                    <tr class="customer-row" data-id="${customer.id}">
                        <td>${customer.id}</td>
                        <td>${escapeHtml(customer.name)}</td>
                        <td>${escapeHtml(customer.phone)}</td>
                        <td>${escapeHtml(customer.email || "")}</td>
                        <td>${escapeHtml(customer.city || "")}</td>
                        <td>${customer.projectsCount}</td>
                        <td>${rupee(customer.revenue)}</td>
                        <td>${simpleDate(customer.createdAt)}</td>
                        <td><button class="btn danger delete-customer" data-id="${customer.id}">Delete</button></td>
                    </tr>
                `).join("") || `<tr><td colspan="9" class="empty-state">No customers found.</td></tr>`}
            </tbody>
        `;

        attachSortableHeaders(table, sortState, draw);
        attachPagination(pagination, paged.totalPages, pageState, draw);

        table.querySelectorAll(".customer-row").forEach(row => {
            row.addEventListener("click", event => {
                if (event.target.closest(".delete-customer")) return;
                showCustomerDetail(row.dataset.id);
            });
        });

        table.querySelectorAll(".delete-customer").forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                if (!window.confirm("Delete customer?")) return;
                await api(`/api/admin/customers/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE" });
                setCollection("customers", load("customers").filter(item => item.id !== button.dataset.id));
                detail.innerHTML = "Select a customer to view linked projects, enquiries, and payment history.";
                toast("Deleted");
                draw();
            });
        });
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const customer = Object.fromEntries(new FormData(form).entries());
        const created = await api("/api/admin/customers", { method: "POST", body: customer });
        upsertById("customers", created);
        toast("Saved");
        form.reset();
        draw();
    });

    searchInput.addEventListener("input", () => { pageState.current = 1; draw(); });
    draw();
}
function initContractors() {
    const form = document.getElementById("contractorForm");
    const searchInput = document.getElementById("contractorSearch");
    const table = document.getElementById("contractorsTable");
    const pagination = document.getElementById("contractorsPagination");
    const detail = document.getElementById("contractorDetailContent");
    const sortState = { key: "id", direction: "asc" };
    const pageState = { current: 1, size: 10 };

    const showContractorDetail = contractorId => {
        const contractor = load("contractors").find(item => item.id === contractorId);
        if (!contractor) return;
        const bills = load("bills").filter(bill => bill.contractor === contractor.name);

        detail.innerHTML = `
            <div class="detail-card">
                <p><strong>Name:</strong> ${escapeHtml(contractor.name)}</p>
                <p><strong>Specialty:</strong> ${escapeHtml(contractor.specialty)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(contractor.phone)}</p>
                <p><strong>Email:</strong> ${escapeHtml(contractor.email || "")}</p>
                <p><strong>Bank Details:</strong> ${escapeHtml(contractor.bank || "")}</p>
                <p><strong>Notes:</strong> ${escapeHtml(contractor.notes || "")}</p>
                <p><strong>Bill History:</strong></p>
                <ul>${bills.map(bill => `<li>${escapeHtml(bill.work)} - ${rupee(bill.amount)} - ${escapeHtml(bill.status)} - Paid ${rupee(bill.paidAmount || 0)}</li>`).join("") || "<li>No bills recorded.</li>"}</ul>
            </div>
        `;
    };

    const draw = () => {
        let contractors = [...load("contractors")];
        const bills = load("bills");
        const query = (searchInput.value || "").toLowerCase();

        if (query) contractors = contractors.filter(contractor => [contractor.name, contractor.specialty, contractor.phone].join(" ").toLowerCase().includes(query));

        contractors = contractors.map(contractor => {
            const contractorBills = bills.filter(bill => bill.contractor === contractor.name);
            const totalBills = contractorBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
            const paidBills = contractorBills.reduce((sum, bill) => sum + Number(bill.paidAmount || 0), 0);
            return { ...contractor, totalBills, paidBills, pendingBills: totalBills - paidBills };
        });

        contractors = sortRecords(contractors, sortState);
        const paged = paginate(contractors, pageState);

        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="id">ID</th>
                    <th data-sort="name">Name</th>
                    <th data-sort="specialty">Specialty</th>
                    <th data-sort="phone">Phone</th>
                    <th>Total Bills (INR)</th>
                    <th>Paid (INR)</th>
                    <th>Pending (INR)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${paged.items.map(contractor => `
                    <tr class="contractor-row" data-id="${contractor.id}">
                        <td>${contractor.id}</td>
                        <td>${escapeHtml(contractor.name)}</td>
                        <td>${escapeHtml(contractor.specialty)}</td>
                        <td>${escapeHtml(contractor.phone)}</td>
                        <td>${rupee(contractor.totalBills)}</td>
                        <td>${rupee(contractor.paidBills)}</td>
                        <td>${rupee(contractor.pendingBills)}</td>
                        <td><button class="btn danger delete-contractor" data-id="${contractor.id}">Delete</button></td>
                    </tr>
                `).join("") || `<tr><td colspan="8" class="empty-state">No contractors found.</td></tr>`}
            </tbody>
        `;

        attachSortableHeaders(table, sortState, draw);
        attachPagination(pagination, paged.totalPages, pageState, draw);

        table.querySelectorAll(".contractor-row").forEach(row => {
            row.addEventListener("click", event => {
                if (event.target.closest(".delete-contractor")) return;
                showContractorDetail(row.dataset.id);
            });
        });

        table.querySelectorAll(".delete-contractor").forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();
                if (!window.confirm("Delete contractor?")) return;
                await api(`/api/admin/contractors/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE" });
                setCollection("contractors", load("contractors").filter(item => item.id !== button.dataset.id));
                detail.innerHTML = "Select a contractor to view bill history and payment details.";
                toast("Deleted");
                draw();
            });
        });
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const contractor = Object.fromEntries(new FormData(form).entries());
        const created = await api("/api/admin/contractors", { method: "POST", body: contractor });
        upsertById("contractors", created);
        toast("Saved");
        form.reset();
        draw();
    });

    searchInput.addEventListener("input", () => { pageState.current = 1; draw(); });
    draw();
}

function initReports() {
    const rangeSelect = document.getElementById("reportRange");
    const startInput = document.getElementById("reportStartDate");
    const endInput = document.getElementById("reportEndDate");

    const draw = () => {
        const projects = filterByRange(load("projects"), rangeSelect.value, startInput.value, endInput.value, "startDate");
        const enquiries = filterByRange(load("enquiries"), rangeSelect.value, startInput.value, endInput.value, "createdAt");
        const expenses = filterByRange(load("expenses"), rangeSelect.value, startInput.value, endInput.value, "date");
        const revenueByMonth = groupByMonth(projects, "startDate", item => Number(item.budget || 0));
        const expenseByCategory = groupByKey(expenses, "category", item => Number(item.amount || 0));
        const statusBreakdown = groupByKey(projects, "status", () => 1);
        const enquiryTrends = groupByMonth(enquiries, "createdAt", () => 1);

        makeChart("revenueChart", "bar", Object.keys(revenueByMonth), Object.values(revenueByMonth), "Monthly Revenue");
        makeChart("expenseChart", "pie", Object.keys(expenseByCategory), Object.values(expenseByCategory), "Expense Breakdown");
        makeChart("statusChart", "doughnut", Object.keys(statusBreakdown), Object.values(statusBreakdown), "Project Status");
        makeChart("enquiryTrendChart", "line", Object.keys(enquiryTrends), Object.values(enquiryTrends), "Enquiry Trends");

        const isCustom = rangeSelect.value === "Custom";
        startInput.style.display = isCustom ? "block" : "none";
        endInput.style.display = isCustom ? "block" : "none";
    };

    [rangeSelect, startInput, endInput].forEach(input => {
        input.addEventListener("change", draw);
        input.addEventListener("input", draw);
    });

    draw();
}

function bindTimeline(projectId) {
    const form = document.getElementById("timelineForm");
    const table = document.getElementById("timelineTable");
    const sortState = { key: "createdAt", direction: "desc" };

    const draw = () => {
        const updates = sortRecords(load("timeline").filter(entry => entry.projectId === projectId), sortState);
        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="date">Date</th>
                    <th data-sort="createdAt">Time</th>
                    <th data-sort="kind">Type</th>
                    <th data-sort="text">Update Description</th>
                </tr>
            </thead>
            <tbody>
                ${updates.map(entry => `
                    <tr>
                        <td>${simpleDate(entry.date)}</td>
                        <td>${timeOnly(entry.createdAt)}</td>
                        <td>${badge(entry.kind)}</td>
                        <td>${escapeHtml(entry.text)}</td>
                    </tr>
                `).join("") || `<tr><td colspan="4" class="empty-state">No timeline entries yet.</td></tr>`}
            </tbody>
        `;
        attachSortableHeaders(table, sortState, draw);
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const update = Object.fromEntries(new FormData(form).entries());
        const created = await api(`/api/admin/projects/${encodeURIComponent(projectId)}/timeline`, { method: "POST", body: update });
        upsertById("timeline", created);
        toast("Saved");
        form.reset();
        draw();
    });

    draw();
}

function bindExpenses(projectId) {
    const form = document.getElementById("expenseForm");
    const table = document.getElementById("expenseTable");
    const summary = document.getElementById("costSummary");
    const sortState = { key: "date", direction: "desc" };

    const draw = () => {
        const project = load("projects").find(item => item.id === projectId);
        const expenses = sortRecords(load("expenses").filter(expense => expense.projectId === projectId), sortState);
        const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const budget = Number(project?.budget || 0);
        const balance = budget - totalSpent;
        const progress = budget ? Math.min(100, Math.round((totalSpent / budget) * 100)) : 0;

        summary.innerHTML = `
            <p>Total Budget vs Spent: <strong>${rupee(budget)}</strong> vs <strong>${rupee(totalSpent)}</strong></p>
            <p>Remaining Balance: <strong>${rupee(balance)}</strong></p>
            <div class="progress"><span style="width:${progress}%"></span></div>
        `;

        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="item">Item Name</th>
                    <th data-sort="category">Category</th>
                    <th data-sort="amount">Amount (INR)</th>
                    <th data-sort="date">Date</th>
                    <th data-sort="by">Added By</th>
                    <th data-sort="notes">Notes</th>
                </tr>
            </thead>
            <tbody>
                ${expenses.map(expense => `
                    <tr>
                        <td>${escapeHtml(expense.item)}</td>
                        <td>${escapeHtml(expense.category)}</td>
                        <td>${rupee(expense.amount)}</td>
                        <td>${simpleDate(expense.date)}</td>
                        <td>${escapeHtml(expense.by)}</td>
                        <td>${escapeHtml(expense.notes || "")}</td>
                    </tr>
                `).join("") || `<tr><td colspan="6" class="empty-state">No expenses recorded.</td></tr>`}
            </tbody>
        `;
        attachSortableHeaders(table, sortState, draw);
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const expense = Object.fromEntries(new FormData(form).entries());
        const created = await api(`/api/admin/projects/${encodeURIComponent(projectId)}/expenses`, { method: "POST", body: expense });
        upsertById("expenses", created);
        toast("Saved");
        form.reset();
        draw();
    });

    draw();
}
function bindBills(projectId) {
    const form = document.getElementById("billForm");
    const table = document.getElementById("billTable");
    const summary = document.getElementById("billsSummary");
    const sortState = { key: "date", direction: "desc" };

    const draw = () => {
        const bills = sortRecords(load("bills").filter(bill => bill.projectId === projectId), sortState);
        const totalBills = bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
        const totalPaid = bills.reduce((sum, bill) => sum + Number(bill.paidAmount || 0), 0);

        summary.innerHTML = `
            <p>Total bills vs total paid: <strong>${rupee(totalBills)}</strong> vs <strong>${rupee(totalPaid)}</strong></p>
            <p>Pending amount: <strong>${rupee(totalBills - totalPaid)}</strong></p>
        `;

        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="contractor">Contractor</th>
                    <th data-sort="work">Work Done</th>
                    <th data-sort="amount">Bill Amount</th>
                    <th data-sort="date">Date</th>
                    <th data-sort="dueDate">Due Date</th>
                    <th data-sort="status">Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${bills.map(bill => `
                    <tr>
                        <td>${escapeHtml(bill.contractor)}</td>
                        <td>${escapeHtml(bill.work)}</td>
                        <td>${rupee(bill.amount)}</td>
                        <td>${simpleDate(bill.date)}</td>
                        <td>${simpleDate(bill.dueDate)}</td>
                        <td>${badge(bill.status)}<div>${bill.paidAmount ? `Paid ${rupee(bill.paidAmount)} / Remaining ${rupee(Number(bill.amount || 0) - Number(bill.paidAmount || 0))}` : ""}</div></td>
                        <td><button class="btn alt mark-paid" data-id="${bill.id}">Mark Paid</button></td>
                    </tr>
                `).join("") || `<tr><td colspan="7" class="empty-state">No bills recorded.</td></tr>`}
            </tbody>
        `;
        attachSortableHeaders(table, sortState, draw);

        table.querySelectorAll(".mark-paid").forEach(button => {
            button.addEventListener("click", async () => {
                const amount = Number(window.prompt("Payment amount INR", "0") || 0);
                if (!amount) return;
                const paidDate = window.prompt("Payment date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10)) || new Date().toISOString().slice(0, 10);
                const updated = await api(`/api/admin/bills/${encodeURIComponent(button.dataset.id)}/pay`, { method: "POST", body: { amount, paidDate } });
                upsertById("bills", updated);
                syncProjectPayments();
                toast("Marked Paid");
                draw();
            });
        });
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const bill = Object.fromEntries(new FormData(form).entries());
        const created = await api(`/api/admin/projects/${encodeURIComponent(projectId)}/bills`, { method: "POST", body: bill });
        upsertById("bills", created);
        syncProjectPayments();
        toast("Saved");
        form.reset();
        draw();
    });

    draw();
}

function bindDocuments(projectId) {
    const form = document.getElementById("documentForm");
    const table = document.getElementById("documentsTable");
    const sortState = { key: "date", direction: "desc" };

    const draw = () => {
        const docs = sortRecords(load("documents").filter(doc => doc.projectId === projectId), sortState);
        table.innerHTML = `
            <thead>
                <tr>
                    <th data-sort="fileName">File Name</th>
                    <th data-sort="type">Type</th>
                    <th data-sort="date">Upload Date</th>
                    <th data-sort="by">Uploaded By</th>
                    <th>Download</th>
                    <th>Delete</th>
                </tr>
            </thead>
            <tbody>
                ${docs.map(doc => `
                    <tr>
                        <td>${escapeHtml(doc.fileName)}</td>
                        <td>${escapeHtml(doc.type)}</td>
                        <td>${fmtDate(doc.date)}</td>
                        <td>${escapeHtml(doc.by)}</td>
                        <td><a class="btn alt" href="${escapeAttribute(doc.fileUrl || "#")}" download="${escapeAttribute(doc.fileName)}">Download</a></td>
                        <td><button class="btn danger delete-doc" data-id="${doc.id}">Delete</button></td>
                    </tr>
                `).join("") || `<tr><td colspan="6" class="empty-state">No documents uploaded.</td></tr>`}
            </tbody>
        `;
        attachSortableHeaders(table, sortState, draw);

        table.querySelectorAll(".delete-doc").forEach(button => {
            button.addEventListener("click", async () => {
                if (!window.confirm("Delete document?")) return;
                await api(`/api/admin/documents/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE" });
                setCollection("documents", load("documents").filter(item => item.id !== button.dataset.id));
                toast("Deleted");
                draw();
            });
        });
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const payload = new FormData(form);
        const created = await api(`/api/admin/projects/${encodeURIComponent(projectId)}/documents`, { method: "POST", body: payload });
        upsertById("documents", created);
        toast("Saved");
        form.reset();
        draw();
    });

    draw();
}

function bindCustomerInfo(project) {
    const target = document.getElementById("customerInfo");
    if (!target) return;

    const customer = load("customers").find(item => item.name === project.client);
    const linkedProjects = load("projects").filter(item => item.client === project.client);
    const linkedEnquiries = load("enquiries").filter(item => item.name === project.client || item.email === customer?.email);

    if (!customer) {
        target.innerHTML = `<div class="empty-state">No customer profile found for ${escapeHtml(project.client)}.</div>`;
        return;
    }

    target.innerHTML = `
        <div class="detail-card">
            <p><strong>Name:</strong> ${escapeHtml(customer.name)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(customer.phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(customer.email || "")}</p>
            <p><strong>Address:</strong> ${escapeHtml(customer.address || "")}</p>
            <p><strong>Notes:</strong> ${escapeHtml(customer.notes || "")}</p>
            <p><strong>All Linked Projects:</strong></p>
            <ul>${linkedProjects.map(linkedProject => `<li>${escapeHtml(linkedProject.name)} - ${escapeHtml(linkedProject.status)}</li>`).join("")}</ul>
            <p><strong>Linked Enquiries:</strong></p>
            <ul>${linkedEnquiries.map(enquiry => `<li>${simpleDate(enquiry.createdAt)} - ${escapeHtml(enquiry.service)} - ${escapeHtml(enquiry.status)}</li>`).join("") || "<li>No linked enquiries.</li>"}</ul>
        </div>
    `;
}

function exportEnquiriesCSV() {
    const enquiries = load("enquiries");
    const rows = [["Date & Time", "Name", "Phone", "Email", "Service", "Message", "Status"]];
    enquiries.forEach(enquiry => rows.push([enquiry.createdAt, enquiry.name, enquiry.phone, enquiry.email, enquiry.service, enquiry.message, enquiry.status]));
    const csv = rows.map(row => row.map(value => `"${String(value || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kasa-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

async function updateEnquiry(id, patch) {
    const updated = await api(`/api/admin/enquiries/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
    upsertById("enquiries", updated);
    return updated;
}

function syncProjectPayments() {
    setCollection("projects", load("projects").map(project => ({
        ...project,
        paid: load("bills").filter(bill => bill.projectId === project.id).reduce((sum, bill) => sum + Number(bill.paidAmount || 0), 0)
    })));
}

function isAuthed() { return Boolean(localStorage.getItem(STORAGE.auth)); }
function clearToken() { localStorage.removeItem(STORAGE.auth); }
function bindLogout() { document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", () => { clearToken(); window.location.href = "index.html"; })); }
function load(key) { return Array.isArray(state[key]) ? state[key] : []; }
function setCollection(key, value) { state[key] = Array.isArray(value) ? value : []; }
function upsertById(key, value) { setCollection(key, [value, ...load(key).filter(item => item.id !== value.id)]); }

function renderSidebar(activePage) {
    const container = document.querySelector("[data-admin-sidebar]");
    if (!container) return;
    container.innerHTML = `
        <div class="admin-header-wrap">
            <div class="admin-brand">
                <div class="admin-logo">KASA ADMIN</div>
                <div class="admin-contact">
                    KASA Interior Design Studio, Gulmohar Path, Shanti Sheela Society, Deccan Gymkhana, Pune, Maharashtra 411038<br>
                    hello@kasainteriors.in · Mon-Sat, 10am - 7pm
                </div>
            </div>
            <nav class="admin-menu">
                <a href="dashboard.html" class="${activePage === "dashboard" ? "active" : ""}">Dashboard</a>
                <a href="enquiries.html" class="${activePage === "enquiries" ? "active" : ""}">Enquiries</a>
                <a href="projects.html" class="${activePage === "projects" || activePage === "project-detail" ? "active" : ""}">Projects</a>
                <a href="customers.html" class="${activePage === "customers" ? "active" : ""}">Customers</a>
                <a href="contractors.html" class="${activePage === "contractors" ? "active" : ""}">Contractors</a>
                <a href="reports.html" class="${activePage === "reports" ? "active" : ""}">Reports</a>
                <a href="../index.html">Public Site</a>
            </nav>
        </div>
    `;
}

function makeChart(canvasId, type, labels, values, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(canvas, {
        type,
        data: { labels, datasets: [{ label, data: values, borderColor: "#c9a96e", backgroundColor: ["#c9a96e", "#8f7348", "#e8c98a", "#5e4a2d", "#b59663", "#f5f0e8"], tension: 0.32, fill: type === "line" }] },
        options: { responsive: true, plugins: { legend: { labels: { color: "#f5f0e8" } } }, scales: type === "pie" || type === "doughnut" ? {} : { x: { ticks: { color: "#f5f0e8" }, grid: { color: "rgba(255,255,255,0.08)" } }, y: { ticks: { color: "#f5f0e8" }, grid: { color: "rgba(255,255,255,0.08)" } } } }
    });
}
function renderSimpleTable(id, headers, rows) {
    const table = document.getElementById(id);
    if (!table) return;
    table.innerHTML = `<thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${headers.length}" class="empty-state">No data available.</td></tr>`}</tbody>`;
}

function attachSortableHeaders(table, sortState, redraw) {
    table.querySelectorAll("th[data-sort]").forEach(header => {
        header.addEventListener("click", () => {
            const key = header.dataset.sort;
            if (sortState.key === key) sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
            else { sortState.key = key; sortState.direction = "asc"; }
            redraw();
        });
    });
}

function attachPagination(container, totalPages, pageState, redraw) {
    if (!container) return;
    const safeTotal = Math.max(1, totalPages);
    pageState.current = Math.min(pageState.current, safeTotal);
    container.innerHTML = `<button class="btn alt" ${pageState.current <= 1 ? "disabled" : ""} data-page="prev">Prev</button><span>${pageState.current} / ${safeTotal}</span><button class="btn alt" ${pageState.current >= safeTotal ? "disabled" : ""} data-page="next">Next</button>`;
    container.querySelector('[data-page="prev"]')?.addEventListener("click", () => { pageState.current -= 1; redraw(); });
    container.querySelector('[data-page="next"]')?.addEventListener("click", () => { pageState.current += 1; redraw(); });
}

function paginate(items, pageState) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageState.size));
    pageState.current = Math.min(pageState.current, totalPages);
    const start = (pageState.current - 1) * pageState.size;
    return { items: items.slice(start, start + pageState.size), totalPages };
}

function sortRecords(items, sortState) {
    const records = [...items];
    records.sort((first, second) => {
        const a = first?.[sortState.key];
        const b = second?.[sortState.key];
        if (typeof a === "number" || typeof b === "number") return sortState.direction === "asc" ? Number(a || 0) - Number(b || 0) : Number(b || 0) - Number(a || 0);
        const dateA = Date.parse(a);
        const dateB = Date.parse(b);
        if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return sortState.direction === "asc" ? dateA - dateB : dateB - dateA;
        return sortState.direction === "asc" ? String(a || "").localeCompare(String(b || ""), "en", { numeric: true }) : String(b || "").localeCompare(String(a || ""), "en", { numeric: true });
    });
    return records;
}

function groupByMonth(items, dateKey, reducer) {
    const grouped = {};
    items.forEach(item => {
        const date = new Date(item[dateKey]);
        if (Number.isNaN(date.getTime())) return;
        const label = date.toLocaleString("en-IN", { month: "short" });
        grouped[label] = (grouped[label] || 0) + reducer(item);
    });
    return grouped;
}

function groupByKey(items, key, reducer) {
    const grouped = {};
    items.forEach(item => {
        const label = item[key] || "Unknown";
        grouped[label] = (grouped[label] || 0) + reducer(item);
    });
    return grouped;
}

function filterByRange(items, range, startDate, endDate, key) {
    const now = new Date();
    return items.filter(item => {
        const date = new Date(item[key]);
        if (Number.isNaN(date.getTime())) return false;
        if (range === "This Month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        if (range === "Last 3 Months") return date >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
        if (range === "This Year") return date.getFullYear() === now.getFullYear();
        if (range === "Custom") return !startDate || !endDate ? true : date >= new Date(startDate) && date <= new Date(`${endDate}T23:59:59`);
        return true;
    });
}

function badge(status = "") { return `<span class="badge ${String(status).toLowerCase().replace(/\s+/g, "")}">${escapeHtml(status)}</span>`; }
function projectProgress(project) { return { Planning: 20, "In Progress": 60, "On Hold": 35, Completed: 100 }[project.status] || 0; }
function toast(text) { const wrap = document.getElementById("toastWrap"); if (!wrap) return; const item = document.createElement("div"); item.className = "toast"; item.textContent = text; wrap.appendChild(item); window.setTimeout(() => item.remove(), 2200); }
function fmtDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : `${date.toLocaleDateString("en-IN")} ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`; }
function simpleDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN"); }
function timeOnly(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); }
function rupee(value) { return `INR ${Number(value || 0).toLocaleString("en-IN")}`; }
function isInCurrentMonth(value) { const date = new Date(value); const now = new Date(); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }
function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }

async function api(url, options = {}) {
    const settings = { method: options.method || "GET", headers: {}, body: undefined };
    if (options.auth !== false) {
        const token = localStorage.getItem(STORAGE.auth);
        if (token) settings.headers.Authorization = `Bearer ${token}`;
    }
    if (options.body instanceof FormData) settings.body = options.body;
    else if (options.body !== undefined) { settings.headers["Content-Type"] = "application/json"; settings.body = JSON.stringify(options.body); }

    const response = await fetch(url, settings);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
        const error = new Error(data?.message || "Request failed");
        error.status = response.status;
        throw error;
    }
    return data;
}
