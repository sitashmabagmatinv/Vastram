import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Eye,
  History,
  LogOut,
  Menu,
  PackagePlus,
  Pencil,
  Ruler,
  Search,
  ShieldCheck,
  Shirt,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { api, clearSession, getStoredUser, saveSession } from "./api.js";

const STATUSES = [
  "received",
  "fabric_selected",
  "cutting",
  "stitching",
  "finishing",
  "quality_check",
  "ready",
  "completed",
  "cancelled"
];

const STATUS_LABELS = {
  received: "Received",
  fabric_selected: "Fabric selected",
  cutting: "Cutting",
  stitching: "Stitching",
  finishing: "Finishing",
  quality_check: "Quality check",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled"
};

const blankCustomer = { full_name: "", phone: "", email: "", address: "", notes: "" };
const blankMeasurement = {
  label: "Standard profile",
  bust: "",
  waist: "",
  hips: "",
  shoulder: "",
  sleeve: "",
  length: "",
  neck: "",
  inseam: "",
  notes: ""
};
const blankFabric = {
  name: "",
  fabric_type: "",
  color: "",
  unit: "meters",
  stock_quantity: "",
  low_stock_threshold: ""
};
const blankOrder = {
  customer_id: "",
  assigned_staff_id: "",
  measurement_id: "",
  primary_fabric_id: "",
  garment_type: "",
  due_date: "",
  notes: ""
};
const blankReadyMade = {
  name: "",
  category: "",
  size: "",
  color: "",
  price: "",
  stock_quantity: "",
  image_url: "",
  description: ""
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function displayDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function niceNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? value : number.toString();
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(form)
      });
      saveSession(data);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <div className="brand-mark">V</div>
        <div>
          <p className="eyebrow">Kathmandu bespoke workflow</p>
          <h1>Vastram</h1>
          <p>
            Measurements, order stages, and fabric stock in one calm boutique workspace.
          </p>
        </div>
        <div className="hero-grid">
          <article>
            <Ruler />
            <span>Reusable measurements</span>
          </article>
          <article>
            <ClipboardList />
            <span>Visual order stages</span>
          </article>
          <article>
            <Boxes />
            <span>Low-stock alerts</span>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Customer register
          </button>
        </div>

        <form onSubmit={submit} className="form-stack">
          {mode === "register" && (
            <>
              <label>
                Name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label>
                Address
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>
            </>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            <ShieldCheck size={18} />
            {loading ? "Checking..." : mode === "login" ? "Enter workspace" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SearchOverlay({ open, onClose, user, setActiveView }) {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [readyMade, setReadyMade] = useState([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    async function load() {
      const [orderData, customerData, fabricData, readyData] = await Promise.all([
        api("/orders").catch(() => ({ orders: [] })),
        user.role === "customer" ? Promise.resolve({ customers: [] }) : api("/customers").catch(() => ({ customers: [] })),
        user.role === "customer" ? Promise.resolve({ fabrics: [] }) : api("/fabrics").catch(() => ({ fabrics: [] })),
        api("/ready-made").catch(() => ({ items: [] }))
      ]);

      if (alive) {
        setOrders(orderData.orders || []);
        setCustomers(customerData.customers || []);
        setFabrics(fabricData.fabrics || []);
        setReadyMade(readyData.items || []);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [open, user.role]);

  if (!open) return null;

  const needle = normalizeText(query);
  const filteredOrders = orders.filter((order) =>
    [order.order_code, order.garment_type, order.customer_name, order.status].some((item) =>
      normalizeText(item).includes(needle)
    )
  );
  const filteredCustomers = customers.filter((customer) =>
    [customer.full_name, customer.phone, customer.email].some((item) => normalizeText(item).includes(needle))
  );
  const filteredFabrics = fabrics.filter((fabric) =>
    [fabric.name, fabric.fabric_type, fabric.color].some((item) => normalizeText(item).includes(needle))
  );
  const filteredReadyMade = readyMade.filter((item) =>
    [item.name, item.category, item.size, item.color].some((value) => normalizeText(value).includes(needle))
  );

  function jump(view) {
    setActiveView(view);
    onClose();
  }

  return (
    <div className="search-overlay">
      <div className="search-head">
        <label className="search-command">
          <Search size={22} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type what you are looking for"
          />
        </label>
        <button className="icon-button light" onClick={onClose} aria-label="Close search">
          <X />
        </button>
      </div>
      <div className="search-suggestions">
        <button onClick={() => jump("orders")}>Orders</button>
        {user.role !== "customer" && <button onClick={() => jump("customers")}>Customers</button>}
        {user.role !== "customer" && <button onClick={() => jump("inventory")}>Inventory</button>}
        <button onClick={() => jump("clothes")}>Clothes</button>
        <button onClick={() => jump("dashboard")}>Dashboard</button>
      </div>
      <div className="search-results">
        <section>
          <h3>Orders</h3>
          {filteredOrders.slice(0, 5).map((order) => (
            <button key={order.id} onClick={() => jump("orders")}>
              <span>{order.order_code}</span>
              <strong>{order.garment_type}</strong>
              <small>{STATUS_LABELS[order.status]}</small>
            </button>
          ))}
        </section>
        {user.role !== "customer" && (
          <section>
            <h3>Customers</h3>
            {filteredCustomers.slice(0, 5).map((customer) => (
              <button key={customer.id} onClick={() => jump("customers")}>
                <span>{customer.phone || "Profile"}</span>
                <strong>{customer.full_name}</strong>
                <small>{customer.email || "No email"}</small>
              </button>
            ))}
          </section>
        )}
        {user.role !== "customer" && (
          <section>
            <h3>Fabrics</h3>
            {filteredFabrics.slice(0, 5).map((fabric) => (
              <button key={fabric.id} onClick={() => jump("inventory")}>
                <span>{fabric.fabric_type}</span>
                <strong>{fabric.name}</strong>
                <small>{fabric.stock_quantity} {fabric.unit}</small>
              </button>
            ))}
          </section>
        )}
        <section>
          <h3>Ready made</h3>
          {filteredReadyMade.slice(0, 5).map((item) => (
            <button key={item.id} onClick={() => jump("clothes")}>
              <span>{item.category} · {item.size}</span>
              <strong>{item.name}</strong>
              <small>{item.stock_quantity} in stock</small>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

function AppShell({ user, onLogout, children, activeView, setActiveView }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: Sparkles, roles: ["admin", "staff", "customer"] },
    { id: "customers", label: "Customers", icon: Users, roles: ["admin", "staff"] },
    { id: "orders", label: "Orders", icon: ClipboardList, roles: ["admin", "staff", "customer"] },
    { id: "clothes", label: "Clothes", icon: Shirt, roles: ["admin", "staff", "customer"] },
    { id: "inventory", label: "Inventory", icon: Boxes, roles: ["admin", "staff"] },
    { id: "measurements", label: "Measurements", icon: Ruler, roles: ["customer"] },
    { id: "staff", label: "Staff", icon: UserPlus, roles: ["admin"] }
  ].filter((item) => item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
        <div className="brand-row">
          <span className="brand-dot">V</span>
          <strong>Vastram</strong>
        </div>
        <button className="search-pill" onClick={() => setSearchOpen(true)}>
          <Search size={17} />
          <span>Find orders, fabric, customer</span>
        </button>
        <div className="user-chip">
          <span>{user.name}</span>
          <small>{user.role}</small>
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Log out">
          <LogOut />
        </button>
      </header>

      <aside className={cx("sidebar", open && "open")}>
        <button className="icon-button close-button" onClick={() => setOpen(false)} aria-label="Close menu">
          <X />
        </button>
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={cx("nav-item", activeView === item.id && "active")}
              onClick={() => {
                setActiveView(item.id);
                setOpen(false);
              }}
            >
              <Icon size={19} />
              {item.label}
            </button>
          );
        })}
      </aside>

      <section className="content">{children}</section>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} user={user} setActiveView={setActiveView} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={cx("metric-card", tone)}>
      <Icon />
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </article>
  );
}

function Dashboard({ user, refreshKey }) {
  const [summary, setSummary] = useState({});
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [summaryData, orderData, alertData] = await Promise.all([
          api("/dashboard/summary"),
          api("/orders"),
          user.role === "customer" ? Promise.resolve({ alerts: [] }) : api("/alerts/low-stock")
        ]);
        if (alive) {
          setSummary(summaryData.summary || {});
          setOrders(orderData.orders || []);
          setAlerts(alertData.alerts || []);
        }
      } catch (err) {
        setError(err.message);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user.role, refreshKey]);

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Live boutique control</p>
        <h2>{user.role === "customer" ? "Your tailoring tracker" : "Today at Vastram"}</h2>
      </section>
      {error && <p className="form-error">{error}</p>}
      <div className="metrics-grid">
        <MetricCard icon={ClipboardList} label="Active orders" value={summary.active_orders} tone="mint" />
        <MetricCard icon={CheckCircle2} label="Ready orders" value={summary.ready_orders || summary.total_orders} tone="rose" />
        <MetricCard icon={Users} label="Customers" value={summary.total_customers || summary.measurement_profiles} tone="gold" />
        {user.role !== "customer" && <MetricCard icon={AlertTriangle} label="Low stock" value={summary.low_stock_count} tone="ink" />}
      </div>

      <div className="feature-band">
        <div>
          <p className="eyebrow">Order flow</p>
          <h3>Stage-based work, visible at a glance.</h3>
        </div>
        <div className="stage-strip">
          {STATUSES.slice(0, 7).map((status) => (
            <span key={status}>{STATUS_LABELS[status]}</span>
          ))}
        </div>
      </div>

      <div className="split-grid">
        <section>
          <div className="list-heading">
            <h3>Recent orders</h3>
          </div>
          <div className="card-grid">
            {orders.slice(0, 6).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
        {user.role !== "customer" && (
          <section>
            <div className="list-heading">
              <h3>Stock alerts</h3>
            </div>
            <div className="card-grid">
              {alerts.map((fabric) => (
                <FabricCard key={fabric.id} fabric={fabric} compact />
              ))}
              {!alerts.length && <EmptyState text="No low-stock fabrics right now." />}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="empty-state">{text}</p>;
}

function OrderCard({ order, onStatus }) {
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const stageIndex = STATUSES.indexOf(order.status);

  async function openDetail() {
    setLoadingDetail(true);
    try {
      const data = await api(`/orders/${order.id}`);
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <article className="data-card product-card interactive-card">
      <div className="card-visual order-visual">
        <div className="order-orbit">
          <ClipboardList />
        </div>
        <span>{order.order_code}</span>
      </div>
      <div className="card-body">
        <span className={cx("status-label", order.status)}>{STATUS_LABELS[order.status]}</span>
        <h3>{order.garment_type}</h3>
        <p>{order.customer_name}</p>
        <div className="meta-row">
          <span>{order.staff_name || "Unassigned"}</span>
          <span>{displayDate(order.due_date)}</span>
        </div>
        <div className="mini-progress" aria-label="Order progress">
          {STATUSES.slice(0, 8).map((status, index) => (
            <span key={status} className={index <= stageIndex ? "done" : ""} />
          ))}
        </div>
        <button className="card-link" onClick={openDetail}>
          <Eye size={16} />
          {loadingDetail ? "Opening" : "View details"}
        </button>
        {onStatus && (
          <div className="status-actions">
            {STATUSES.slice(0, 8).map((status) => (
              <button key={status} onClick={() => onStatus(order.id, status)} className={order.status === status ? "active" : ""}>
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}
      </div>
      {detail && <OrderDetailModal detail={detail} onClose={() => setDetail(null)} onStatus={onStatus} />}
    </article>
  );
}

function OrderDetailModal({ detail, onClose, onStatus }) {
  const { order, history } = detail;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="detail-modal">
        <div className="detail-hero">
          <button className="icon-button light" onClick={onClose} aria-label="Close order detail">
            <X />
          </button>
          <span className={cx("status-label", order.status)}>{STATUS_LABELS[order.status]}</span>
          <h2>{order.garment_type}</h2>
          <p>{order.order_code} · {order.customer_name}</p>
        </div>
        <div className="detail-grid">
          <article>
            <span>Assigned staff</span>
            <strong>{order.staff_name || "Unassigned"}</strong>
          </article>
          <article>
            <span>Fabric</span>
            <strong>{order.fabric_name || "Not selected"}</strong>
          </article>
          <article>
            <span>Due date</span>
            <strong>{displayDate(order.due_date)}</strong>
          </article>
        </div>
        <div className="timeline">
          <h3><History size={18} /> Status history</h3>
          {history.map((item) => (
            <article key={item.id}>
              <span>{STATUS_LABELS[item.status]}</span>
              <strong>{item.note || "Status updated"}</strong>
              <small>{displayDate(item.created_at)} · {item.changed_by_name || "System"}</small>
            </article>
          ))}
        </div>
        {onStatus && (
          <div className="detail-actions">
            {STATUSES.slice(0, 8).map((status) => (
              <button key={status} onClick={() => onStatus(order.id, status)} className={order.status === status ? "active" : ""}>
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FabricCard({ fabric, compact, onMovement, onEdit, onArchive, onHistory }) {
  const status = fabric.stock_status || (Number(fabric.stock_quantity) <= Number(fabric.low_stock_threshold) ? "Low Stock" : "Available");
  return (
    <article className="data-card product-card interactive-card">
      <div className="card-visual fabric-visual">
        <span className="swatch" style={{ background: fabric.color }} />
        <span>{fabric.fabric_type}</span>
      </div>
      <div className="card-body">
        <span className={cx("status-label", status === "Available" ? "available" : "low")}>{status}</span>
        <h3>{fabric.name}</h3>
        <p>{fabric.color} · {fabric.unit}</p>
        <div className="meta-row">
          <span>{fabric.stock_quantity} in stock</span>
          <span>Min {fabric.low_stock_threshold}</span>
        </div>
        {onHistory && (
          <button className="card-link" onClick={() => onHistory(fabric)}>
            <History size={16} />
            Movement history
          </button>
        )}
        {!compact && onMovement && (
          <div className="movement-row">
            <button onClick={() => onMovement(fabric.id, "add")}>Add</button>
            <button onClick={() => onMovement(fabric.id, "deduct")}>Deduct</button>
            {onEdit && <button onClick={() => onEdit(fabric)}><Pencil size={14} /> Edit</button>}
            {onArchive && <button onClick={() => onArchive(fabric.id)}><Trash2 size={14} /> Archive</button>}
          </div>
        )}
      </div>
    </article>
  );
}

const CLOTHING_ORDER_LABELS = {
  requested: "Requested",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled"
};

function ReadyMadeCard({ item, user, onEdit, onArchive, onOrder }) {
  const image = item.image_url || "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80";
  const status = item.stock_status || (Number(item.stock_quantity) <= 0 ? "Out" : Number(item.stock_quantity) <= 2 ? "Few Left" : "Available");

  return (
    <article className="data-card product-card ready-card interactive-card">
      <div className="card-visual ready-visual" style={{ backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(23, 22, 20, 0.58)), url("${image}")` }}>
        <span className={cx("status-label", status === "Available" ? "available" : "low")}>{status}</span>
        <span>{item.category}</span>
      </div>
      <div className="card-body">
        <h3>{item.name}</h3>
        <p>{item.description || "Ready-made boutique item available for walk-in customers."}</p>
        <div className="meta-row">
          <span>Size {item.size}</span>
          <span>{item.color}</span>
          <span>{item.price ? `Rs. ${niceNumber(item.price)}` : "Price on request"}</span>
        </div>
        <div className="meta-row">
          <span>{item.stock_quantity} in stock</span>
          <span>{user.role === "customer" ? "Available now" : "Catalog item"}</span>
        </div>
        {user.role === "admin" && (
          <div className="movement-row">
            <button onClick={() => onEdit(item)}>
              <Pencil size={14} />
              Edit
            </button>
            <button onClick={() => onArchive(item.id)}>
              <Trash2 size={14} />
              Archive
            </button>
          </div>
        )}
        {user.role === "customer" && (
          <button className="primary-action stock-order-button" onClick={() => onOrder(item)} disabled={Number(item.stock_quantity) <= 0}>
            <Shirt size={16} />
            Order this
          </button>
        )}
      </div>
    </article>
  );
}

function CustomersPage({ bumpRefresh }) {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [customerForm, setCustomerForm] = useState(blankCustomer);
  const [measurementForm, setMeasurementForm] = useState(blankMeasurement);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editingMeasurementId, setEditingMeasurementId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function loadCustomers(term = search) {
    const data = await api(`/customers?search=${encodeURIComponent(term)}`);
    setCustomers(data.customers || []);
    if (!selected && data.customers?.length) setSelected(data.customers[0]);
  }

  useEffect(() => {
    loadCustomers().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api(`/customers/${selected.id}/measurements`)
      .then((data) => setMeasurements(data.measurements || []))
      .catch((err) => setError(err.message));
  }, [selected]);

  async function createCustomer(event) {
    event.preventDefault();
    const data = editingCustomerId
      ? await api(`/customers/${editingCustomerId}`, { method: "PATCH", body: JSON.stringify(customerForm) })
      : await api("/customers", { method: "POST", body: JSON.stringify(customerForm) });
    setCustomerForm(blankCustomer);
    setEditingCustomerId(null);
    setSelected(data.customer);
    await loadCustomers();
    bumpRefresh();
  }

  async function createMeasurement(event) {
    event.preventDefault();
    if (!selected) return;
    if (editingMeasurementId) {
      await api(`/measurements/${editingMeasurementId}`, { method: "PATCH", body: JSON.stringify(measurementForm) });
    } else {
      await api(`/customers/${selected.id}/measurements`, { method: "POST", body: JSON.stringify(measurementForm) });
    }
    setMeasurementForm(blankMeasurement);
    setEditingMeasurementId(null);
    const data = await api(`/customers/${selected.id}/measurements`);
    setMeasurements(data.measurements || []);
    bumpRefresh();
  }

  function editCustomer(customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      full_name: customer.full_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || ""
    });
  }

  function editMeasurement(measurement) {
    setEditingMeasurementId(measurement.id);
    setMeasurementForm({
      label: measurement.label || "",
      bust: niceNumber(measurement.bust || ""),
      waist: niceNumber(measurement.waist || ""),
      hips: niceNumber(measurement.hips || ""),
      shoulder: niceNumber(measurement.shoulder || ""),
      sleeve: niceNumber(measurement.sleeve || ""),
      length: niceNumber(measurement.length || ""),
      neck: niceNumber(measurement.neck || ""),
      inseam: niceNumber(measurement.inseam || ""),
      notes: measurement.notes || ""
    });
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Measurement memory</p>
        <h2>Customers</h2>
      </section>
      {error && <p className="form-error">{error}</p>}
      <div className="tool-row">
        <label className="search-input">
          <Search size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer" />
        </label>
        <button className="secondary-action" onClick={() => loadCustomers()}>
          Search
        </button>
      </div>

      <div className="split-grid wide-left">
        <section className="panel">
          <h3>{editingCustomerId ? "Edit customer" : "Add customer"}</h3>
          <form className="form-grid" onSubmit={createCustomer}>
            {Object.keys(blankCustomer).map((key) => (
              <label key={key}>
                {key.replace("_", " ")}
                <input
                  value={customerForm[key]}
                  onChange={(e) => setCustomerForm({ ...customerForm, [key]: e.target.value })}
                  required={key === "full_name"}
                />
              </label>
            ))}
            <button className="primary-action" type="submit">
              <UserPlus size={18} />
              {editingCustomerId ? "Update customer" : "Save customer"}
            </button>
            {editingCustomerId && (
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setEditingCustomerId(null);
                  setCustomerForm(blankCustomer);
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
        </section>

        <section>
          <div className="card-grid">
            {customers.map((customer) => (
              <button
                key={customer.id}
                className={cx("customer-tile", selected?.id === customer.id && "active")}
                onClick={() => setSelected(customer)}
              >
                <strong>{customer.full_name}</strong>
                <span>{customer.phone || customer.email || "No contact"}</span>
                <small>
                  <Pencil size={13} /> Select to manage
                </small>
              </button>
            ))}
            {!customers.length && <EmptyState text="No customers found." />}
          </div>
        </section>
      </div>

      {selected && (
        <section className="panel">
          <div className="list-heading">
            <h3>{selected.full_name} measurements</h3>
            <button className="secondary-action" onClick={() => editCustomer(selected)}>
              <Pencil size={16} />
              Edit profile
            </button>
          </div>
          <form className="form-grid measurement-form" onSubmit={createMeasurement}>
            {Object.keys(blankMeasurement).map((key) => (
              <label key={key}>
                {key}
                <input
                  value={measurementForm[key]}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, [key]: e.target.value })}
                />
              </label>
            ))}
            <button className="primary-action" type="submit">
              <Ruler size={18} />
              {editingMeasurementId ? "Update measurement" : "Save measurement"}
            </button>
            {editingMeasurementId && (
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setEditingMeasurementId(null);
                  setMeasurementForm(blankMeasurement);
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          <div className="measurement-list">
            {measurements.map((measurement) => (
              <article className="measurement-pill interactive-card" key={measurement.id}>
                <strong>{measurement.label}</strong>
                <span>Bust {measurement.bust || "-"} · Waist {measurement.waist || "-"} · Length {measurement.length || "-"}</span>
                <button className="card-link" onClick={() => editMeasurement(measurement)}>
                  <Pencil size={15} />
                  Edit
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OrdersPage({ user, bumpRefresh }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [form, setForm] = useState(blankOrder);
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const orderData = await api("/orders");
    setOrders(orderData.orders || []);
    if (user.role !== "customer") {
      const [customerData, userData, fabricData] = await Promise.all([
        api("/customers"),
        user.role === "admin" ? api("/users") : Promise.resolve({ users: [] }),
        api("/fabrics")
      ]);
      setCustomers(customerData.customers || []);
      setStaff((userData.users || []).filter((item) => item.role === "staff" && item.active));
      setFabrics(fabricData.fabrics || []);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!form.customer_id) {
      setMeasurements([]);
      return;
    }
    api(`/customers/${form.customer_id}/measurements`)
      .then((data) => setMeasurements(data.measurements || []))
      .catch(() => setMeasurements([]));
  }, [form.customer_id]);

  async function createOrder(event) {
    event.preventDefault();
    await api("/orders", { method: "POST", body: JSON.stringify(form) });
    setForm(blankOrder);
    await load();
    bumpRefresh();
  }

  async function updateStatus(id, status) {
    await api(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: `Moved to ${STATUS_LABELS[status]}` })
    });
    await load();
    bumpRefresh();
  }

  const displayedOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch = [order.order_code, order.garment_type, order.customer_name, order.staff_name]
      .some((item) => normalizeText(item).includes(normalizeText(orderSearch)));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Visual workflow</p>
        <h2>Orders</h2>
      </section>
      {error && <p className="form-error">{error}</p>}

      <div className="collection-toolbar">
        <label className="search-input">
          <Search size={18} />
          <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search orders" />
        </label>
        <div className="chip-row">
          <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>All</button>
          {STATUSES.slice(0, 8).map((status) => (
            <button key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}>
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {user.role !== "customer" && (
        <section className="panel">
          <h3>Create order</h3>
          <form className="form-grid" onSubmit={createOrder}>
            <label>
              Customer
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option value={customer.id} key={customer.id}>{customer.full_name}</option>
                ))}
              </select>
            </label>
            {user.role === "admin" && (
              <label>
                Staff
                <select value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {staff.map((member) => (
                    <option value={member.id} key={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Measurement
              <select value={form.measurement_id} onChange={(e) => setForm({ ...form, measurement_id: e.target.value })}>
                <option value="">Select later</option>
                {measurements.map((measurement) => (
                  <option value={measurement.id} key={measurement.id}>{measurement.label}</option>
                ))}
              </select>
            </label>
            <label>
              Fabric
              <select value={form.primary_fabric_id} onChange={(e) => setForm({ ...form, primary_fabric_id: e.target.value })}>
                <option value="">Select fabric</option>
                {fabrics.map((fabric) => (
                  <option value={fabric.id} key={fabric.id}>{fabric.name} · {fabric.color}</option>
                ))}
              </select>
            </label>
            <label>
              Garment type
              <input value={form.garment_type} onChange={(e) => setForm({ ...form, garment_type: e.target.value })} required />
            </label>
            <label>
              Due date
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </label>
            <label>
              Notes
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button className="primary-action" type="submit">
              <PackagePlus size={18} />
              Create order
            </button>
          </form>
        </section>
      )}

      <div className="card-grid orders-grid">
        {displayedOrders.map((order) => (
          <OrderCard key={order.id} order={order} onStatus={user.role === "customer" ? null : updateStatus} />
        ))}
        {!displayedOrders.length && <EmptyState text="No orders match this view." />}
      </div>
    </div>
  );
}

function InventoryPage({ user, bumpRefresh }) {
  const [fabrics, setFabrics] = useState([]);
  const [form, setForm] = useState(blankFabric);
  const [editingId, setEditingId] = useState(null);
  const [movementDetail, setMovementDetail] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const data = await api("/fabrics");
    setFabrics(data.fabrics || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createFabric(event) {
    event.preventDefault();
    if (editingId) {
      await api(`/fabrics/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
    } else {
      await api("/fabrics", { method: "POST", body: JSON.stringify(form) });
    }
    setForm(blankFabric);
    setEditingId(null);
    await load();
    bumpRefresh();
  }

  function editFabric(fabric) {
    setEditingId(fabric.id);
    setForm({
      name: fabric.name || "",
      fabric_type: fabric.fabric_type || "",
      color: fabric.color || "",
      unit: fabric.unit || "meters",
      stock_quantity: niceNumber(fabric.stock_quantity),
      low_stock_threshold: niceNumber(fabric.low_stock_threshold)
    });
  }

  async function archiveFabric(id) {
    if (!window.confirm("Archive this fabric item?")) return;
    await api(`/fabrics/${id}`, { method: "DELETE" });
    await load();
    bumpRefresh();
  }

  async function openHistory(fabric) {
    const data = await api(`/fabrics/${fabric.id}/movements`);
    setMovementDetail({ fabric, movements: data.movements || [] });
  }

  async function movement(id, movement_type) {
    const quantity = window.prompt(`Quantity to ${movement_type}`);
    if (!quantity) return;
    await api(`/fabrics/${id}/movements`, {
      method: "POST",
      body: JSON.stringify({ movement_type, quantity, note: `${movement_type} from inventory screen` })
    });
    await load();
    bumpRefresh();
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Fabric control</p>
        <h2>Inventory</h2>
      </section>
      {error && <p className="form-error">{error}</p>}
      {user.role === "admin" && (
        <section className="panel">
          <h3>Add fabric</h3>
          <form className="form-grid" onSubmit={createFabric}>
            {Object.keys(blankFabric).map((key) => (
              <label key={key}>
                {key.replaceAll("_", " ")}
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required={["name", "fabric_type", "color"].includes(key)}
                />
              </label>
            ))}
            <button className="primary-action" type="submit">
              <Boxes size={18} />
              {editingId ? "Update fabric" : "Save fabric"}
            </button>
            {editingId && (
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(blankFabric);
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
        </section>
      )}
      <div className="card-grid">
        {fabrics.map((fabric) => (
          <FabricCard
            key={fabric.id}
            fabric={fabric}
            onMovement={user.role === "admin" ? movement : null}
            onEdit={user.role === "admin" ? editFabric : null}
            onArchive={user.role === "admin" ? archiveFabric : null}
            onHistory={user.role === "admin" ? openHistory : null}
          />
        ))}
      </div>
      {movementDetail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="detail-modal compact-modal">
            <div className="detail-hero fabric-detail">
              <button className="icon-button light" onClick={() => setMovementDetail(null)} aria-label="Close movement history">
                <X />
              </button>
              <span className="status-label available">Inventory</span>
              <h2>{movementDetail.fabric.name}</h2>
              <p>{movementDetail.fabric.stock_quantity} {movementDetail.fabric.unit} currently in stock</p>
            </div>
            <div className="timeline">
              <h3><History size={18} /> Movement history</h3>
              {movementDetail.movements.map((item) => (
                <article key={item.id}>
                  <span>{item.movement_type}</span>
                  <strong>{niceNumber(item.quantity)} {movementDetail.fabric.unit}</strong>
                  <small>{item.note || "No note"} · {item.created_by_name || "System"}</small>
                </article>
              ))}
              {!movementDetail.movements.length && <EmptyState text="No movements recorded yet." />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ReadyMadePage({ user, bumpRefresh }) {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(blankReadyMade);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function load(term = search) {
    const [itemData, orderData] = await Promise.all([
      api(`/ready-made?search=${encodeURIComponent(term)}`),
      api("/ready-made/orders")
    ]);
    setItems(itemData.items || []);
    setOrders(orderData.orders || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveItem(event) {
    event.preventDefault();
    if (editingId) {
      await api(`/ready-made/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
    } else {
      await api("/ready-made", { method: "POST", body: JSON.stringify(form) });
    }
    setForm(blankReadyMade);
    setEditingId(null);
    await load();
    bumpRefresh();
  }

  function editItem(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      category: item.category || "",
      size: item.size || "",
      color: item.color || "",
      price: niceNumber(item.price || ""),
      stock_quantity: niceNumber(item.stock_quantity || ""),
      image_url: item.image_url || "",
      description: item.description || ""
    });
  }

  async function archiveItem(id) {
    if (!window.confirm("Archive this ready-made item?")) return;
    await api(`/ready-made/${id}`, { method: "DELETE" });
    await load();
    bumpRefresh();
  }

  async function orderItem(item) {
    const note = window.prompt(`Add a note for ${item.name}, or leave blank`);
    await api(`/ready-made/${item.id}/orders`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1, note: note || "" })
    });
    await load();
    bumpRefresh();
  }

  async function updateClothingOrder(id, status) {
    await api(`/ready-made/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await load();
    bumpRefresh();
  }

  const availableCount = items.filter((item) => Number(item.stock_quantity) > 0).length;

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Available boutique stock</p>
        <h2>Clothes</h2>
      </section>
      {error && <p className="form-error">{error}</p>}

      <div className="feature-band ready-band">
        <div>
          <p className="eyebrow">{user.role === "customer" ? "Shop available pieces" : "Catalog control"}</p>
          <h3>{availableCount} ready-made pieces available now.</h3>
        </div>
        <div className="stage-strip">
          <span>In stock only for customers</span>
          <span>Immediate fitting</span>
          <span>Single boutique inventory</span>
        </div>
      </div>

      <div className="tool-row">
        <label className="search-input">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clothes" />
        </label>
        <button className="secondary-action" onClick={() => load()}>
          Search
        </button>
      </div>

      {user.role === "admin" && (
        <section className="panel">
          <h3>{editingId ? "Edit clothing item" : "Add clothing item"}</h3>
          <form className="form-grid" onSubmit={saveItem}>
            {Object.keys(blankReadyMade).map((key) => (
              <label key={key}>
                {key.replaceAll("_", " ")}
                <input
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  required={["name", "category", "size", "color"].includes(key)}
                />
              </label>
            ))}
            <button className="primary-action" type="submit">
              <Shirt size={18} />
              {editingId ? "Update item" : "Save item"}
            </button>
            {editingId && (
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(blankReadyMade);
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
        </section>
      )}

      <div className="card-grid orders-grid">
        {items.map((item) => (
          <ReadyMadeCard
            key={item.id}
            item={item}
            user={user}
            onEdit={editItem}
            onArchive={archiveItem}
            onOrder={orderItem}
          />
        ))}
        {!items.length && <EmptyState text="No clothes available in this view." />}
      </div>

      <section className="panel">
        <div className="list-heading">
          <h3>{user.role === "customer" ? "Your clothing orders" : "Clothing order requests"}</h3>
        </div>
        <div className="clothing-order-list">
          {orders.map((order) => (
            <article className="clothing-order-row" key={order.id}>
              <img src={order.image_url || "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=300&q=80"} alt="" />
              <div>
                <span className={cx("status-label", order.status === "completed" ? "available" : "fabric_selected")}>
                  {CLOTHING_ORDER_LABELS[order.status]}
                </span>
                <strong>{order.item_name}</strong>
                <small>
                  {order.customer_name ? `${order.customer_name} · ` : ""}
                  Qty {order.quantity} · {order.size} · {order.color}
                </small>
              </div>
              {user.role !== "customer" && (
                <div className="chip-row row-actions">
                  {Object.keys(CLOTHING_ORDER_LABELS).map((status) => (
                    <button key={status} className={order.status === status ? "active" : ""} onClick={() => updateClothingOrder(order.id, status)}>
                      {CLOTHING_ORDER_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          {!orders.length && <EmptyState text={user.role === "customer" ? "You have not ordered any clothes yet." : "No clothing order requests yet."} />}
        </div>
      </section>
    </div>
  );
}

function StaffPage({ bumpRefresh }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function load() {
    const data = await api("/users");
    setUsers(data.users || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createStaff(event) {
    event.preventDefault();
    await api("/users/staff", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", email: "", password: "" });
    await load();
    bumpRefresh();
  }

  async function deactivateStaff(id) {
    if (!window.confirm("Deactivate this account?")) return;
    await api(`/users/${id}`, { method: "DELETE" });
    await load();
    bumpRefresh();
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Role-based access</p>
        <h2>Staff accounts</h2>
      </section>
      {error && <p className="form-error">{error}</p>}
      <section className="panel">
        <h3>Add staff</h3>
        <form className="form-grid" onSubmit={createStaff}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          <button className="primary-action" type="submit">
            <UserPlus size={18} />
            Create staff
          </button>
        </form>
      </section>
      <div className="card-grid">
        {users.map((member) => (
          <article className="customer-tile interactive-card" key={member.id}>
            <strong>{member.name}</strong>
            <span>{member.email}</span>
            <small>{member.role} · {member.active ? "active" : "inactive"}</small>
            {member.role !== "admin" && member.active && (
              <button className="card-link danger" onClick={() => deactivateStaff(member.id)}>
                <Trash2 size={15} />
                Deactivate
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function MeasurementPortal() {
  const [customer, setCustomer] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const customerData = await api("/customers");
        const ownCustomer = customerData.customers?.[0];
        setCustomer(ownCustomer || null);
        if (ownCustomer) {
          const measurementData = await api(`/customers/${ownCustomer.id}/measurements`);
          setMeasurements(measurementData.measurements || []);
        }
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  return (
    <div className="page-stack">
      <section className="section-heading">
        <p className="eyebrow">Your saved fit</p>
        <h2>Measurements</h2>
      </section>
      {error && <p className="form-error">{error}</p>}
      <div className="feature-band profile-band">
        <div>
          <p className="eyebrow">Customer profile</p>
          <h3>{customer?.full_name || "Measurement profile"}</h3>
        </div>
        <div className="stage-strip">
          <span>{customer?.phone || "Phone not saved"}</span>
          <span>{customer?.email || "Email not saved"}</span>
        </div>
      </div>
      <div className="card-grid">
        {measurements.map((measurement) => (
          <article className="measurement-showcase interactive-card" key={measurement.id}>
            <span className="status-label available">{measurement.label}</span>
            <h3>{measurement.label}</h3>
            <div className="measurement-grid">
              {["bust", "waist", "hips", "shoulder", "sleeve", "length", "neck", "inseam"].map((key) => (
                <span key={key}>
                  <small>{key}</small>
                  <strong>{measurement[key] || "-"}</strong>
                </span>
              ))}
            </div>
            <p>{measurement.notes || "No fitting notes saved."}</p>
          </article>
        ))}
        {!measurements.length && <EmptyState text="No measurements have been saved by the boutique yet." />}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [activeView, setActiveView] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    if (!user) return;
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {
        clearSession();
        setUser(null);
      });
  }, []);

  useEffect(() => {
    if (user?.role === "customer" && ["customers", "inventory", "staff"].includes(activeView)) {
      setActiveView("dashboard");
    }
    if (user?.role === "staff" && activeView === "staff") {
      setActiveView("dashboard");
    }
  }, [user, activeView]);

  const currentPage = useMemo(() => {
    if (!user) return null;
    if (activeView === "customers") return <CustomersPage bumpRefresh={bumpRefresh} />;
    if (activeView === "orders") return <OrdersPage user={user} bumpRefresh={bumpRefresh} />;
    if (activeView === "clothes") return <ReadyMadePage user={user} bumpRefresh={bumpRefresh} />;
    if (activeView === "inventory") return <InventoryPage user={user} bumpRefresh={bumpRefresh} />;
    if (activeView === "measurements") return <MeasurementPortal />;
    if (activeView === "staff") return <StaffPage bumpRefresh={bumpRefresh} />;
    return <Dashboard user={user} refreshKey={refreshKey} />;
  }, [activeView, user, refreshKey]);

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <AppShell
      user={user}
      activeView={activeView}
      setActiveView={setActiveView}
      onLogout={() => {
        clearSession();
        setUser(null);
      }}
    >
      {currentPage}
    </AppShell>
  );
}
