import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:8080";

const ISSUE_TYPES = {
    question: { bg: "rgba(51,122,183,0.15)", fg: "#337ab7", label: "question" },
    bug: { bg: "rgba(217,83,79,0.15)", fg: "#d9534f", label: "bug" },
    documentation: { bg: "rgba(240,173,78,0.15)", fg: "#f0ad4e", label: "documentation" },
    feature: { bg: "rgba(92,184,92,0.15)", fg: "#5cb85c", label: "feature" },
};

const PRIORITIES = {
    low: { fg: "#777777", label: "low" },
    medium: { fg: "#f0ad4e", label: "medium" },
    high: { fg: "#d9534f", label: "high" },
};

const STATUS_LABELS = {
    todo: { bg: "rgba(51,122,183,0.15)", fg: "#337ab7", label: "todo" },
    in_progress: { bg: "rgba(240,173,78,0.15)", fg: "#f0ad4e", label: "in progress" },
    done: { bg: "rgba(92,184,92,0.15)", fg: "#5cb85c", label: "done" },
};

const USER_TYPES = [
    { value: 0, label: "admin" },
    { value: 1, label: "user" },
    { value: 2, label: "viewonly" },
];

// Il backend restituisce type/priority/status come numeri (enum C#),
// mentre l'UI lavora con chiavi stringa: qui mappiamo indice -> chiave.
const ISSUE_TYPE_KEYS = Object.keys(ISSUE_TYPES);
const PRIORITY_KEYS = Object.keys(PRIORITIES);
const STATUS_KEYS = Object.keys(STATUS_LABELS);

function typeKeyOf(issue) {
    if (typeof issue.type === "number") return ISSUE_TYPE_KEYS[issue.type] ?? "bug";
    return String(issue.type).toLowerCase();
}
function priorityKeyOf(issue) {
    if (typeof issue.priority === "number") return PRIORITY_KEYS[issue.priority] ?? "medium";
    return String(issue.priority).toLowerCase();
}
function statusKeyOf(issue) {
    if (typeof issue.status === "number") return STATUS_KEYS[issue.status] ?? "todo";
    return String(issue.status).toLowerCase();
}

function decodeJwtPayload(token) {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
                .join("")
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

export default function MainPage({ onLogout }) {
    // --- filtri e ordinamento ---
    const [filterType, setFilterType] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("id_desc");

    // --- issue list ---
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // --- form nuova issue ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState("bug");
    const [priority, setPriority] = useState("medium");
    const [newAccessUserIds, setNewAccessUserIds] = useState([]);
    const [newDueDate, setNewDueDate] = useState("");
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [creating, setCreating] = useState(false);

    // --- lightbox ---
    const [lightboxUrl, setLightboxUrl] = useState(null);

    // --- commenti ---
    const [expandedIssueId, setExpandedIssueId] = useState(null);
    const [commentsByIssue, setCommentsByIssue] = useState({});
    const [commentDraft, setCommentDraft] = useState("");
    const [commentPosting, setCommentPosting] = useState(false);

    // --- modifica issue ---
    const [editingIssue, setEditingIssue] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editType, setEditType] = useState("bug");
    const [editPriority, setEditPriority] = useState("medium");
    const [editStatus, setEditStatus] = useState("todo");
    const [editAccessUserIds, setEditAccessUserIds] = useState([]);
    const [editDueDate, setEditDueDate] = useState("");

    // --- picker "aggiungi persone" (condiviso tra creazione e modifica) ---
    const [accessPickerFor, setAccessPickerFor] = useState(null); // "create" | "edit" | null
    const [accessPickerQuery, setAccessPickerQuery] = useState("");

    // --- eliminazione issue ---
    const [deletingId, setDeletingId] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState("");
    const [users, setUsers] = useState([]);

    // --- pannello admin ---
    const [showUserPanel, setShowUserPanel] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserType, setNewUserType] = useState(1);
    const [userCreating, setUserCreating] = useState(false);
    const [userMsg, setUserMsg] = useState(null);

    // --- cambio password ---
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState(null);

    // --- auth ---
    const token = localStorage.getItem("bugboard_token");
    const authHeaders = { Authorization: `Bearer ${token}` };
    const payload = token ? decodeJwtPayload(token) : null;
    const role =
        payload?.role ??
        payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    const isAdmin = role === "Admin";
    const rawUserId =
        payload?.nameid ??
        payload?.sub ??
        payload?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const currentUserId = rawUserId != null ? Number(rawUserId) : null;

    function canEditIssue(issue) {
        return isAdmin || (currentUserId != null && issue.viewers?.some((v) => v.userId === currentUserId));
    }

    function currentAccessSetter() {
        return accessPickerFor === "create" ? setNewAccessUserIds : setEditAccessUserIds;
    }

    function currentAccessList() {
        return accessPickerFor === "create" ? newAccessUserIds : editAccessUserIds;
    }

    function openAccessPicker(target) {
        setAccessPickerFor(target);
        setAccessPickerQuery("");
        if (users.length === 0) fetchUsers();
    }

    function closeAccessPicker() {
        setAccessPickerFor(null);
        setAccessPickerQuery("");
    }

    function addAccessUser(id) {
        const setList = currentAccessSetter();
        setList((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }

    function removeAccessUser(target, id) {
        const setList = target === "create" ? setNewAccessUserIds : setEditAccessUserIds;
        setList((prev) => prev.filter((x) => x !== id));
    }

    async function handleDeleteIssue(issueId) {
        if (!window.confirm("Eliminare definitivamente questo bug? L'operazione non è reversibile.")) return;
        setDeletingId(issueId);
        try {
            await axios.delete(`${API_BASE_URL}/api/issues/${issueId}`, { headers: authHeaders });
            setIssues((prev) => prev.filter((iss) => iss.id !== issueId));
            if (editingIssue?.id === issueId) closeEditModal();
        } catch (err) {
            if (err.response?.status === 401) { handleLogout(); return; }
            window.alert("Eliminazione fallita. Riprova.");
        } finally {
            setDeletingId(null);
        }
    }

    function closeUserPanel() {
        setShowUserPanel(false);
        setUserMsg(null);
    }

    function openPasswordModal() {
        setShowPasswordModal(true);
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        setPasswordMsg(null);
    }

    function closePasswordModal() {
        setShowPasswordModal(false);
        setPasswordMsg(null);
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ type: "err", text: "le due password non coincidono." });
            return;
        }
        setPasswordSaving(true);
        setPasswordMsg(null);
        try {
            await axios.post(
                `${API_BASE_URL}/api/auth/change-password`,
                { oldPassword, newPassword },
                { headers: authHeaders }
            );
            setPasswordMsg({ type: "ok", text: "password aggiornata." });
            setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        } catch (err) {
            if (err.response?.status === 401) { handleLogout(); return; }
            const text = err.response?.data?.message || "modifica password fallita.";
            setPasswordMsg({ type: "err", text });
        } finally {
            setPasswordSaving(false);
        }
    }

    function handleLogout() {
        localStorage.removeItem("bugboard_token");
        onLogout?.();
    }

    const fetchIssues = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await axios.get(`${API_BASE_URL}/api/issues`, { headers: authHeaders });
            setIssues(res.data);
        } catch (err) {
            if (err.response?.status === 401) { handleLogout(); return; }
            setError("Impossibile caricare le issue. Il server è attivo?");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchIssues(); }, [fetchIssues]);
    useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

    function handleImageChange(e) {
        const file = e.target.files?.[0] || null;
        setImage(file);
        setImagePreview(file ? URL.createObjectURL(file) : null);
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (!title.trim()) return;
        setCreating(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("title", title);
            formData.append("description", description);
            formData.append("type", type);
            formData.append("priority", priority);
            if (isAdmin && newAccessUserIds.length > 0) {
                newAccessUserIds.forEach((uid) => formData.append("accessUserIds", uid));
            }
            if (isAdmin && newDueDate !== "") {
                formData.append("dueDate", newDueDate);
            }
            if (image) formData.append("image", image);
            await axios.post(`${API_BASE_URL}/api/issues`, formData, {
                headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
            });
            setTitle(""); setDescription(""); setType("bug");
            setPriority("medium"); setImage(null); setImagePreview(null);
            setNewAccessUserIds([]); setNewDueDate("");
            setShowCreateModal(false);
            fetchIssues();
        } catch {
            setError("Creazione fallita. Controlla i campi e riprova.");
        } finally {
            setCreating(false);
        }
    }

    async function fetchComments(issueId) {
        setCommentsByIssue((prev) => ({
            ...prev,
            [issueId]: { ...(prev[issueId] || { items: [] }), loading: true, error: "" },
        }));
        try {
            const res = await axios.get(`${API_BASE_URL}/api/issues/${issueId}/comments`, { headers: authHeaders });
            setCommentsByIssue((prev) => ({
                ...prev,
                [issueId]: { items: res.data, loading: false, error: "" },
            }));
        } catch (err) {
            if (err.response?.status === 401) { handleLogout(); return; }
            setCommentsByIssue((prev) => ({
                ...prev,
                [issueId]: { items: prev[issueId]?.items || [], loading: false, error: "impossibile caricare i commenti." },
            }));
        }
    }

    function toggleComments(issueId) {
        const opening = expandedIssueId !== issueId;
        setExpandedIssueId(opening ? issueId : null);
        setCommentDraft("");
        if (opening && !commentsByIssue[issueId]) {
            fetchComments(issueId);
        }
    }

    async function handlePostComment(e, issueId) {
        e.preventDefault();
        if (!commentDraft.trim()) return;
        setCommentPosting(true);
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/issues/${issueId}/comments`,
                { text: commentDraft },
                { headers: authHeaders }
            );
            setCommentsByIssue((prev) => ({
                ...prev,
                [issueId]: {
                    items: [...(prev[issueId]?.items || []), res.data],
                    loading: false,
                    error: "",
                },
            }));
            setCommentDraft("");
        } catch (err) {
            if (err.response?.status === 401) { handleLogout(); return; }
            setCommentsByIssue((prev) => ({
                ...prev,
                [issueId]: { ...(prev[issueId] || { items: [] }), error: "invio del commento fallito." },
            }));
        } finally {
            setCommentPosting(false);
        }
    }

    async function fetchUsers() {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/users`, { headers: authHeaders });
            setUsers(res.data);
        } catch {
            // se l'endpoint di listing utenti non è ancora disponibile, la tendina resta vuota
        }
    }

    function openEditModal(issue) {
        setEditingIssue(issue);
        setEditTitle(issue.title);
        setEditDescription(issue.description || "");
        setEditType(typeKeyOf(issue));
        setEditPriority(priorityKeyOf(issue));
        setEditStatus(statusKeyOf(issue));
        setEditAccessUserIds((issue.viewers || []).map((v) => v.userId));
        setEditDueDate(issue.dueDate ? issue.dueDate.slice(0, 10) : "");
        setEditError("");
        if (isAdmin && users.length === 0) fetchUsers();
    }

    function closeEditModal() {
        setEditingIssue(null);
        setEditError("");
    }

    async function handleUpdateIssue(e) {
        e.preventDefault();
        if (!editingIssue) return;
        setEditSaving(true);
        setEditError("");
        try {
            const body = {
                title: editTitle,
                description: editDescription,
                type: ISSUE_TYPE_KEYS.indexOf(editType),
                priority: PRIORITY_KEYS.indexOf(editPriority),
                status: STATUS_KEYS.indexOf(editStatus),
                accessUserIds: isAdmin ? editAccessUserIds : undefined,
                dueDate: isAdmin ? (editDueDate === "" ? null : editDueDate) : undefined,
            };
            const res = await axios.put(`${API_BASE_URL}/api/issues/${editingIssue.id}`, body, {
                headers: authHeaders,
            });
            setIssues((prev) => prev.map((iss) => (iss.id === editingIssue.id ? res.data : iss)));
            closeEditModal();
        } catch (err) {
            if (err.response?.status === 401) { handleLogout(); return; }
            if (err.response?.status === 403) {
                setEditError("non hai i permessi per modificare questo bug.");
            } else {
                setEditError("modifica fallita. riprova.");
            }
        } finally {
            setEditSaving(false);
        }
    }

    async function handleCreateUser(e) {
        e.preventDefault();
        setUserCreating(true);
        setUserMsg(null);
        try {
            await axios.post(
                `${API_BASE_URL}/api/users`,
                { email: newUserEmail, password: newUserPassword, type: Number(newUserType) },
                { headers: authHeaders }
            );
            setUserMsg({ type: "ok", text: "Utente creato con successo." });
            setNewUserEmail(""); setNewUserPassword(""); setNewUserType(1);
        } catch (err) {
            setUserMsg({ type: "err", text: err.response?.data?.message || "Creazione utente fallita." });
        } finally {
            setUserCreating(false);
        }
    }

    return (
        <div style={styles.page}>
            {/* HEADER */}
            <header style={styles.header}>
                <span style={styles.logoText}>BugBoard</span>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowCreateModal(true)} style={styles.newIssueBtn}>
                        + nuova issue
                    </button>
                    {isAdmin && (
                        <button onClick={() => setShowUserPanel((s) => !s)} style={styles.adminBtn}>
                            + aggiungi utente
                        </button>
                    )}
                    <button onClick={openPasswordModal} style={styles.passwordBtn}>
                        cambia password
                    </button>
                    <button onClick={handleLogout} style={styles.logoutBtn}>esci</button>
                </div>
            </header>

            {/* MODALE ADMIN */}
            {isAdmin && showUserPanel && (
                <div style={styles.overlay} onClick={closeUserPanel}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.sectionTitle}>
                                <span style={styles.labelIndex}>admin</span> nuovo utente
                            </h2>
                            <button onClick={closeUserPanel} style={styles.closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleCreateUser} style={styles.form}>
                            <input type="email" placeholder="email" value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)} style={styles.input} required autoFocus />
                            <input type="password" placeholder="password temporanea" value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)} style={styles.input} required minLength={6} />
                            <div style={styles.typeRow}>
                                {USER_TYPES.map((t) => (
                                    <button key={t.value} type="button" onClick={() => setNewUserType(t.value)}
                                        style={{
                                            ...styles.typeChip,
                                            background: newUserType === t.value ? "rgba(92,184,92,0.15)" : "transparent",
                                            color: newUserType === t.value ? "#5cb85c" : "#777777",
                                            borderColor: newUserType === t.value ? "#5cb85c" : "#cccccc"
                                        }}>
                                        {t.value} · {t.label}
                                    </button>
                                ))}
                            </div>
                            {userMsg && (
                                <div style={userMsg.type === "ok" ? styles.successBox : styles.errorBox}>
                                    {userMsg.text}
                                </div>
                            )}
                            <button type="submit" disabled={userCreating}
                                style={{ ...styles.submitBtn, opacity: userCreating ? 0.6 : 1 }}>
                                {userCreating ? "creazione…" : "crea utente"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODALE CAMBIO PASSWORD */}
            {showPasswordModal && (
                <div style={styles.overlay} onClick={closePasswordModal}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.sectionTitle}>
                                <span style={styles.labelIndex}></span> cambia password 
                            </h2> 
                            <button onClick={closePasswordModal} style={styles.closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleChangePassword} style={styles.form}>
                            <input type="password" placeholder="vecchia password" value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)} style={styles.input} required autoFocus />
                            <input type="password" placeholder="nuova password" value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)} style={styles.input} required minLength={6} />
                            <input type="password" placeholder="conferma nuova password" value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)} style={styles.input} required minLength={6} />

                            {passwordMsg && (
                                <div style={passwordMsg.type === "ok" ? styles.successBox : styles.errorBox}>
                                    {passwordMsg.text}
                                </div>
                            )}

                            <button type="submit" disabled={passwordSaving}
                                style={{ ...styles.submitBtn, opacity: passwordSaving ? 0.6 : 1 }}>
                                {passwordSaving ? "salvataggio…" : "aggiorna password"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* LIGHTBOX IMMAGINE */}
            {lightboxUrl && (
                <div style={styles.overlay} onClick={() => setLightboxUrl(null)}>
                    <div style={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setLightboxUrl(null)}
                            style={{ ...styles.closeBtn, position: "absolute", top: -32, right: 0, fontSize: 18 }}>
                            ✕
                        </button>
                        <img src={lightboxUrl} alt="allegato" style={styles.lightboxImg} />
                    </div>
                </div>
            )}

            {/* MODALE MODIFICA ISSUE */}
            {editingIssue && (
                <div style={styles.overlay} onClick={closeEditModal}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.sectionTitle}>
                                <span style={styles.labelIndex}>✎</span> modifica bug #{editingIssue.id}
                            </h2>
                            <button onClick={closeEditModal} style={styles.closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleUpdateIssue} style={styles.form}>
                            <input type="text" placeholder="titolo" value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)} style={styles.input} required />
                            <textarea placeholder="descrizione" value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                style={{ ...styles.input, minHeight: 70, resize: "vertical" }} />

                            <label style={styles.fieldLabel}>tipo</label>
                            <div style={styles.typeRow}>
                                {Object.entries(ISSUE_TYPES).map(([key, v]) => (
                                    <button key={key} type="button" onClick={() => setEditType(key)}
                                        style={{
                                            ...styles.typeChip,
                                            background: editType === key ? v.bg : "transparent",
                                            color: editType === key ? v.fg : "#777777",
                                            borderColor: editType === key ? v.fg : "#cccccc"
                                        }}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>

                            <label style={styles.fieldLabel}>priorità</label>
                            <div style={styles.typeRow}>
                                {Object.entries(PRIORITIES).map(([key, v]) => (
                                    <button key={key} type="button" onClick={() => setEditPriority(key)}
                                        style={{
                                            ...styles.typeChip,
                                            background: editPriority === key ? "rgba(0,0,0,0.05)" : "transparent",
                                            color: editPriority === key ? v.fg : "#777777",
                                            borderColor: editPriority === key ? v.fg : "#cccccc"
                                        }}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>

                            <label style={styles.fieldLabel}>stato</label>
                            <div style={styles.typeRow}>
                                {Object.entries(STATUS_LABELS).map(([key, v]) => (
                                    <button key={key} type="button" onClick={() => setEditStatus(key)}
                                        style={{
                                            ...styles.typeChip,
                                            background: editStatus === key ? v.bg : "transparent",
                                            color: editStatus === key ? v.fg : "#777777",
                                            borderColor: editStatus === key ? v.fg : "#cccccc"
                                        }}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>

                            {isAdmin && (
                                <>
                                    <label style={styles.fieldLabel}>chi può vedere / modificare questo bug</label>
                                    <div style={styles.accessChips}>
                                        {editAccessUserIds.map((id) => {
                                            const u = users.find((x) => x.id === id);
                                            return (
                                                <span key={id} style={styles.accessChip}>
                                                    {u ? u.email : `#${id}`}
                                                    <button type="button" onClick={() => removeAccessUser("edit", id)}
                                                        style={styles.chipRemove}>✕</button>
                                                </span>
                                            );
                                        })}
                                        <button type="button" onClick={() => openAccessPicker("edit")}
                                            style={styles.addChipBtn}>
                                            + aggiungi
                                        </button>
                                    </div>

                                    <label style={styles.fieldLabel}>scadenza per la risoluzione (opzionale)</label>
                                    <input type="date"
                                        value={editDueDate}
                                        onChange={(e) => setEditDueDate(e.target.value)}
                                        style={styles.input} />
                                </>
                            )}

                            {editError && (
                                <div style={styles.errorBox}>
                                    <span style={styles.errorTag}>errore</span> {editError}
                                </div>
                            )}

                            <button type="submit" disabled={editSaving}
                                style={{ ...styles.submitBtn, opacity: editSaving ? 0.6 : 1 }}>
                                {editSaving ? "salvataggio…" : "salva modifiche"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODALE NUOVA ISSUE */}
            {showCreateModal && (
                <div style={styles.overlay} onClick={() => setShowCreateModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.sectionTitle}>
                                <span style={styles.labelIndex}>+</span> nuova issue
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} style={styles.closeBtn}>✕</button>
                        </div>
                        <form onSubmit={handleCreate} style={styles.form}>
                            <input type="text" placeholder="titolo" value={title}
                                onChange={(e) => setTitle(e.target.value)} style={styles.input} required autoFocus />
                            <textarea placeholder="descrizione" value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                style={{ ...styles.input, minHeight: 70, resize: "vertical" }} />

                            <label style={styles.fieldLabel}>tipo</label>
                            <div style={styles.typeRow}>
                                {Object.entries(ISSUE_TYPES).map(([key, v]) => (
                                    <button key={key} type="button" onClick={() => setType(key)}
                                        style={{
                                            ...styles.typeChip,
                                            background: type === key ? v.bg : "transparent",
                                            color: type === key ? v.fg : "#777777",
                                            borderColor: type === key ? v.fg : "#cccccc"
                                        }}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>

                            <label style={styles.fieldLabel}>priorità</label>
                            <div style={styles.typeRow}>
                                {Object.entries(PRIORITIES).map(([key, v]) => (
                                    <button key={key} type="button" onClick={() => setPriority(key)}
                                        style={{
                                            ...styles.typeChip,
                                            background: priority === key ? "rgba(0,0,0,0.05)" : "transparent",
                                            color: priority === key ? v.fg : "#777777",
                                            borderColor: priority === key ? v.fg : "#cccccc"
                                        }}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>

                            {isAdmin && (
                                <>
                                    <label style={styles.fieldLabel}>chi può vedere / modificare (opzionale)</label>
                                    <div style={styles.accessChips}>
                                        {newAccessUserIds.map((id) => {
                                            const u = users.find((x) => x.id === id);
                                            return (
                                                <span key={id} style={styles.accessChip}>
                                                    {u ? u.email : `#${id}`}
                                                    <button type="button" onClick={() => removeAccessUser("create", id)}
                                                        style={styles.chipRemove}>✕</button>
                                                </span>
                                            );
                                        })}
                                        <button type="button" onClick={() => openAccessPicker("create")}
                                            style={styles.addChipBtn}>
                                            + aggiungi
                                        </button>
                                    </div>

                                    <label style={styles.fieldLabel}>scadenza per la risoluzione (opzionale)</label>
                                    <input type="date"
                                        value={newDueDate}
                                        onChange={(e) => setNewDueDate(e.target.value)}
                                        style={styles.input} />
                                </>
                            )}

                            <label style={styles.fieldLabel}>immagine (opzionale)</label>
                            <input type="file" accept="image/*" onChange={handleImageChange} style={styles.fileInput} />
                            {imagePreview && (
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <img src={imagePreview} alt="anteprima" style={styles.previewImg} />
                                    <button type="button" onClick={() => { setImage(null); setImagePreview(null); }}
                                        style={styles.removeImgBtn}>
                                        rimuovi
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div style={styles.errorBox}>
                                    <span style={styles.errorTag}>errore</span> {error}
                                </div>
                            )}

                            <button type="submit" disabled={creating}
                                style={{ ...styles.submitBtn, opacity: creating ? 0.6 : 1 }}>
                                {creating ? "creazione…" : "crea issue"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* POPUP PICKER "AGGIUNGI PERSONE" (condiviso creazione/modifica) */}
            {accessPickerFor && (
                <div style={styles.accessPickerOverlay} onClick={closeAccessPicker}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.sectionTitle}>
                                <span style={styles.labelIndex}>+</span> aggiungi persone
                            </h2>
                            <button onClick={closeAccessPicker} style={styles.closeBtn}>✕</button>
                        </div>
                        <input
                            type="text"
                            placeholder="cerca per email…"
                            value={accessPickerQuery}
                            onChange={(e) => setAccessPickerQuery(e.target.value)}
                            style={styles.input}
                            autoFocus
                        />
                        <ul style={styles.pickerList}>
                            {users.length === 0 && (
                                <li style={styles.muted}>nessun utente disponibile</li>
                            )}
                            {users
                                .filter((u) =>
                                    u.email.toLowerCase().includes(accessPickerQuery.trim().toLowerCase())
                                )
                                .map((u) => {
                                    const selected = currentAccessList().includes(u.id);
                                    return (
                                        <li key={u.id} style={styles.pickerRow}>
                                            <span>{u.email}</span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    selected ? removeAccessUser(accessPickerFor, u.id) : addAccessUser(u.id)
                                                }
                                                style={selected ? styles.pickerRemoveBtn : styles.pickerAddBtn}
                                            >
                                                {selected ? "rimuovi" : "aggiungi"}
                                            </button>
                                        </li>
                                    );
                                })}
                        </ul>
                        <button type="button" onClick={closeAccessPicker} style={styles.submitBtn}>
                            fatto
                        </button>
                    </div>
                </div>
            )}

            {/* MAIN */}
            <main style={styles.main}>
                {/* LISTA ISSUE */}
                <section style={styles.card}>
                    <div style={styles.listHeader}>
                        <h2 style={styles.sectionTitle}>
                            <span style={styles.labelIndex}>#</span> issue tracciate
                        </h2>
                        <button onClick={fetchIssues} style={styles.refreshBtn}>aggiorna</button>
                    </div>

                    {/* RICERCA */}
                    <div style={styles.searchBar}>
                        <input
                            type="text"
                            placeholder="cerca per titolo o descrizione…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={styles.searchInput}
                        />
                        {searchQuery !== "" && (
                            <button onClick={() => setSearchQuery("")} style={styles.searchClearBtn}>✕</button>
                        )}
                    </div>

                    {/* BARRA FILTRI */}
                    <div style={styles.filterBar}>
                        <div style={styles.filterGroup}>
                            <span style={styles.filterLabel}>tipo</span>
                            <div style={styles.filterChips}>
                                {["all", ...Object.keys(ISSUE_TYPES)].map((k) => (
                                    <button key={k} onClick={() => setFilterType(k)}
                                        style={{
                                            ...styles.filterChip,
                                            background: filterType === k ? "rgba(122,162,247,0.15)" : "transparent",
                                            color: filterType === k ? "#337ab7" : "#777777",
                                            borderColor: filterType === k ? "#337ab7" : "#cccccc"
                                        }}>
                                        {k === "all" ? "tutti" : k}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={styles.filterGroup}>
                            <span style={styles.filterLabel}>stato</span>
                            <div style={styles.filterChips}>
                                {["all", ...Object.keys(STATUS_LABELS)].map((k) => (
                                    <button key={k} onClick={() => setFilterStatus(k)}
                                        style={{
                                            ...styles.filterChip,
                                            background: filterStatus === k ? "rgba(122,162,247,0.15)" : "transparent",
                                            color: filterStatus === k ? "#337ab7" : "#777777",
                                            borderColor: filterStatus === k ? "#337ab7" : "#cccccc"
                                        }}>
                                        {k === "all" ? "tutti" : STATUS_LABELS[k]?.label ?? k}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={styles.filterGroup}>
                            <span style={styles.filterLabel}>priorità</span>
                            <div style={styles.filterChips}>
                                {["all", ...Object.keys(PRIORITIES)].map((k) => (
                                    <button key={k} onClick={() => setFilterPriority(k)}
                                        style={{
                                            ...styles.filterChip,
                                            background: filterPriority === k ? "rgba(122,162,247,0.15)" : "transparent",
                                            color: filterPriority === k ? "#337ab7" : "#777777",
                                            borderColor: filterPriority === k ? "#337ab7" : "#cccccc"
                                        }}>
                                        {k === "all" ? "tutte" : k}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={styles.filterGroup}>
                            <span style={styles.filterLabel}>ordina</span>
                            <div style={styles.filterChips}>
                                {[
                                    { value: "id_desc", label: "più recenti" },
                                    { value: "id_asc", label: "più vecchie" },
                                    { value: "prio_asc", label: "priorità ↑" },
                                    { value: "prio_desc", label: "priorità ↓" },
                                ].map((opt) => (
                                    <button key={opt.value} onClick={() => setSortBy(opt.value)}
                                        style={{
                                            ...styles.filterChip,
                                            background: sortBy === opt.value ? "rgba(122,162,247,0.15)" : "transparent",
                                            color: sortBy === opt.value ? "#337ab7" : "#777777",
                                            borderColor: sortBy === opt.value ? "#337ab7" : "#cccccc"
                                        }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const PRIO_ORDER = { low: 0, medium: 1, high: 2 };
                        const q = searchQuery.trim().toLowerCase();
                        let filtered = issues
                            .filter((iss) => filterType === "all" || typeKeyOf(iss) === filterType)
                            .filter((iss) => filterStatus === "all" || statusKeyOf(iss) === filterStatus)
                            .filter((iss) => filterPriority === "all" || priorityKeyOf(iss) === filterPriority)
                            .filter((iss) =>
                                q === "" ||
                                iss.title?.toLowerCase().includes(q) ||
                                iss.description?.toLowerCase().includes(q)
                            );

                        filtered = [...filtered].sort((a, b) => {
                            if (sortBy === "id_asc") return (a.id ?? 0) - (b.id ?? 0);
                            if (sortBy === "id_desc") return (b.id ?? 0) - (a.id ?? 0);
                            if (sortBy === "prio_asc") return (PRIO_ORDER[priorityKeyOf(a)] ?? 1) - (PRIO_ORDER[priorityKeyOf(b)] ?? 1);
                            if (sortBy === "prio_desc") return (PRIO_ORDER[priorityKeyOf(b)] ?? 1) - (PRIO_ORDER[priorityKeyOf(a)] ?? 1);
                            return 0;
                        });

                        if (loading) return <p style={styles.muted}>caricamento…</p>;
                        if (filtered.length === 0)
                            return <p style={styles.muted}>
                                {issues.length === 0
                                    ? "nessuna issue ancora. crea la prima qui sopra."
                                    : "nessuna issue corrisponde ai filtri selezionati."}
                            </p>;

                        return (
                            <ul style={styles.list}>
                                {filtered.map((issue, i) => {
                                    const typeInfo = ISSUE_TYPES[typeKeyOf(issue)] || ISSUE_TYPES.bug;
                                    const prioInfo = PRIORITIES[priorityKeyOf(issue)] || PRIORITIES.medium;
                                    const statusInfo = STATUS_LABELS[statusKeyOf(issue)] || STATUS_LABELS.todo;
                                    const fullImgUrl = issue.imageUrl
                                        ? issue.imageUrl.startsWith("http")
                                            ? issue.imageUrl
                                            : `${API_BASE_URL}${issue.imageUrl}`
                                        : null;

                                    const isOverdue =
                                        issue.dueDate && statusKeyOf(issue) !== "done" && new Date(issue.dueDate) < new Date();

                                    return (
                                        <li key={issue.id ?? i} style={styles.listItem}>
                                            <div style={styles.listItemTop}>
                                                <span style={styles.listItemTitle}>{issue.title}</span>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <span style={{ ...styles.badge, background: typeInfo.bg, color: typeInfo.fg }}>
                                                        {typeInfo.label}
                                                    </span>
                                                    <span style={{ ...styles.badge, background: statusInfo.bg, color: statusInfo.fg }}>
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={styles.listItemMeta}>
                                                <span style={{ color: prioInfo.fg }}>● {prioInfo.label}</span>
                                                <span style={styles.assignedTag}>
                                                    {issue.viewers?.length
                                                        ? ` ${issue.viewers.map((v) => v.email).join(", ")}`
                                                        : "nessuno (solo admin)"}
                                                </span>
                                                {issue.dueDate && (
                                                    <span style={{ ...styles.dueTag, ...(isOverdue ? styles.dueTagOverdue : {}) }}>
                                                        {isOverdue ? " scaduta il " : " scade il "}
                                                        {new Date(issue.dueDate).toLocaleDateString("it-IT")}
                                                    </span>
                                                )}
                                                {fullImgUrl && (
                                                    <button onClick={() => setLightboxUrl(fullImgUrl)} style={styles.imageLink}>
                                                        {issue.imageUrl.split("/").pop()}
                                                    </button>
                                                )}
                                                {canEditIssue(issue) && (
                                                    <button onClick={() => openEditModal(issue)} style={styles.editBtn}>
                                                        modifica
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => handleDeleteIssue(issue.id)}
                                                        disabled={deletingId === issue.id}
                                                        style={{ ...styles.deleteBtn, opacity: deletingId === issue.id ? 0.5 : 1 }}
                                                    >
                                                        {deletingId === issue.id ? "elimino…" : " elimina"}
                                                    </button>
                                                )}
                                            </div>

                                            {issue.description && (
                                                <p style={styles.listItemDesc}>{issue.description}</p>
                                            )}

                                            <button onClick={() => toggleComments(issue.id)} style={styles.commentsToggle}>
                                                {expandedIssueId === issue.id ? "nascondi commenti" : "commenti"}
                                                {commentsByIssue[issue.id]?.items?.length
                                                    ? ` (${commentsByIssue[issue.id].items.length})`
                                                    : ""}
                                            </button>

                                            {expandedIssueId === issue.id && (
                                                <div style={styles.commentsSection}>
                                                    {commentsByIssue[issue.id]?.loading && (
                                                        <p style={styles.muted}>caricamento commenti…</p>
                                                    )}
                                                    {commentsByIssue[issue.id]?.error && (
                                                        <div style={styles.errorBox}>{commentsByIssue[issue.id].error}</div>
                                                    )}
                                                    {!commentsByIssue[issue.id]?.loading &&
                                                        commentsByIssue[issue.id]?.items?.length === 0 && (
                                                            <p style={styles.muted}>nessun commento. sii il primo a scrivere.</p>
                                                        )}

                                                    <ul style={styles.commentList}>
                                                        {commentsByIssue[issue.id]?.items?.map((c) => (
                                                            <li key={c.id} style={styles.commentItem}>
                                                                <div style={styles.commentMeta}>
                                                                    <span style={styles.commentAuthor}>{c.authorEmail}</span>
                                                                    <span style={styles.commentDate}>
                                                                        {new Date(c.createdAt).toLocaleString("it-IT")}
                                                                    </span>
                                                                </div>
                                                                <p style={styles.commentText}>{c.text}</p>
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    <form onSubmit={(e) => handlePostComment(e, issue.id)} style={styles.commentForm}>
                                                        <textarea
                                                            placeholder="scrivi un commento, aggiornamento o richiesta di chiarimento…"
                                                            value={commentDraft}
                                                            onChange={(e) => setCommentDraft(e.target.value)}
                                                            style={{ ...styles.input, minHeight: 50, resize: "vertical" }}
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={commentPosting}
                                                            style={{
                                                                ...styles.submitBtn,
                                                                opacity: commentPosting ? 0.6 : 1,
                                                                padding: "8px 14px",
                                                                fontSize: 12,
                                                                marginTop: 0,
                                                            }}
                                                        >
                                                            {commentPosting ? "invio…" : "invia commento"}
                                                        </button>
                                                    </form>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        );
                    })()}
                </section>
            </main>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        width: "100%",
        background: "#f2f2f2",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#222222",
    },
    header: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 25px", borderBottom: "1px solid #cccccc", background: "#ffffff",
    },
    logoText: { fontSize: 20, fontWeight: "bold", color: "#222" },
    logoutBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#666666", fontFamily: "inherit", fontSize: 12, padding: "6px 12px", cursor: "pointer",
    },
    adminBtn: {
        background: "rgba(92,184,92,0.15)", border: "1px solid #5cb85c", borderRadius: 4,
        color: "#5cb85c", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
        padding: "6px 12px", cursor: "pointer",
    },
    newIssueBtn: {
        background: "rgba(51,122,183,0.15)", border: "1px solid #337ab7", borderRadius: 4,
        color: "#337ab7", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
        padding: "6px 12px", cursor: "pointer",
    },
    passwordBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#666666", fontFamily: "inherit", fontSize: 12,
        padding: "6px 12px", cursor: "pointer",
    },
    overlay: {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.15)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 50, padding: 20,
    },
    accessPickerOverlay: {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.15)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 60, padding: 20,
    },
    modal: {
        width: "100%", maxWidth: 380, background: "#ffffff",
        border: "1px solid #bbbbbb", borderRadius: 6, padding: 22,
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    },
    modalHeader: {
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4,
    },
    closeBtn: {
        background: "transparent", border: "none", color: "#777777",
        fontSize: 14, cursor: "pointer", padding: 4, lineHeight: 1,
    },
    lightboxContent: {
        position: "relative", maxWidth: "90vw", maxHeight: "90vh",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    lightboxImg: {
        maxWidth: "90vw", maxHeight: "90vh", borderRadius: 6,
        border: "1px solid #bbbbbb", boxShadow: "0 2px 10px rgba(0,0,0,0.25)", display: "block",
    },
    main: {
        maxWidth: 720, margin: "0 auto", padding: "32px 24px",
        display: "flex", flexDirection: "column", gap: 24,
    },
    card: {
        background: "#ffffff", border: "1px solid #cccccc", borderRadius: 6, padding: 22,
    },
    searchBar: {
        display: "flex", alignItems: "center", gap: 8,
        marginTop: 4, marginBottom: 4,
    },
    searchInput: {
        flex: 1,
        background: "#f7f7f7", border: "1px solid #cccccc", borderRadius: 4,
        color: "#333333", fontFamily: "inherit", fontSize: 13,
        padding: "8px 10px",
    },
    searchClearBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#777777", fontFamily: "inherit", fontSize: 12,
        padding: "6px 10px", cursor: "pointer",
    },
    filterBar: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 0",
        marginBottom: 12,
        borderBottom: "1px solid #dddddd",
    },
    filterGroup: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
    },
    filterLabel: {
        color: "#999999",
        fontSize: 11,
        minWidth: 48,
    },
    filterChips: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
    },
    filterChip: {
        border: "1px solid #cccccc",
        borderRadius: 4,
        padding: "3px 10px",
        fontSize: 11,
        fontFamily: "inherit",
        cursor: "pointer",
    },
    listHeader: {
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14, color: "#111111", display: "flex", alignItems: "center", gap: 8, margin: 0,
    },
    labelIndex: { color: "#5cb85c", fontSize: 13 },
    fieldLabel: { color: "#777777", fontSize: 11, marginTop: 4, marginBottom: -4 },
    form: { display: "flex", flexDirection: "column", gap: 12, marginTop: 16 },
    input: {
        background: "#ffffff", border: "1px solid #cccccc", borderRadius: 4,
        padding: "10px 12px", color: "#222222", fontSize: 14, fontFamily: "inherit",
        outline: "none", width: "100%", boxSizing: "border-box",
    },
    fileInput: { color: "#666666", fontSize: 12, fontFamily: "inherit" },
    previewImg: {
        width: 64, height: 64, objectFit: "cover",
        borderRadius: 4, border: "1px solid #cccccc",
    },
    removeImgBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#d9534f", fontFamily: "inherit", fontSize: 11, padding: "5px 10px", cursor: "pointer",
    },
    typeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
    typeChip: {
        border: "1px solid #cccccc", borderRadius: 4, padding: "6px 12px",
        fontSize: 12, fontFamily: "inherit", cursor: "pointer",
    },
    submitBtn: {
        background: "#5cb85c", border: "none", borderRadius: 4, padding: "11px 16px",
        color: "#ffffff", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
        cursor: "pointer", marginTop: 4,
    },
    refreshBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#5cb85c", fontFamily: "inherit", fontSize: 12, padding: "5px 10px", cursor: "pointer",
    },
    muted: { color: "#999999", fontSize: 13 },
    list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
    listItem: {
        border: "1px solid #cccccc", borderRadius: 4, padding: "12px 14px", background: "#ffffff",
    },
    listItemTop: {
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
    },
    listItemMeta: {
        display: "flex", alignItems: "center", gap: 12, fontSize: 11, marginTop: 6,
    },
    listItemTitle: { fontSize: 14, color: "#111111", fontWeight: 600 },
    listItemDesc: { fontSize: 12.5, color: "#666666", marginTop: 6, marginBottom: 0 },
    imageLink: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#337ab7", fontFamily: "inherit", fontSize: 11,
        padding: "3px 8px", cursor: "pointer",
    },
    assignedTag: { color: "#888888", fontSize: 11 },
    dueTag: {
        fontSize: 11, color: "#777777", background: "#f7f7f7",
        border: "1px solid #cccccc", borderRadius: 4, padding: "2px 8px",
    },
    dueTagOverdue: {
        color: "#c9302c", borderColor: "#c9302c", background: "rgba(201,48,44,0.08)",
    },
    accessChips: {
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
    },
    accessChip: {
        display: "flex", alignItems: "center", gap: 6,
        background: "#f7f7f7", border: "1px solid #cccccc", borderRadius: 12,
        color: "#333333", fontSize: 11.5, padding: "4px 6px 4px 10px",
    },
    chipRemove: {
        background: "transparent", border: "none", color: "#777777",
        fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1,
    },
    addChipBtn: {
        background: "transparent", border: "1px dashed #bbbbbb", borderRadius: 12,
        color: "#337ab7", fontFamily: "inherit", fontSize: 11.5,
        padding: "4px 12px", cursor: "pointer",
    },
    pickerList: {
        listStyle: "none", margin: "10px 0", padding: 0,
        maxHeight: 240, overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 4,
    },
    pickerRow: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 10px", borderRadius: 4, background: "#f7f7f7",
        border: "1px solid #dddddd", fontSize: 12.5, color: "#333333",
    },
    pickerAddBtn: {
        background: "rgba(51,122,183,0.15)", border: "1px solid #337ab7", borderRadius: 4,
        color: "#337ab7", fontFamily: "inherit", fontSize: 11,
        padding: "4px 10px", cursor: "pointer",
    },
    pickerRemoveBtn: {
        background: "rgba(201,48,44,0.1)", border: "1px solid #c9302c", borderRadius: 4,
        color: "#c9302c", fontFamily: "inherit", fontSize: 11,
        padding: "4px 10px", cursor: "pointer",
    },
    editBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#f0ad4e", fontFamily: "inherit", fontSize: 11,
        padding: "3px 8px", cursor: "pointer", marginLeft: "auto",
    },
    deleteBtn: {
        background: "transparent", border: "1px solid #cccccc", borderRadius: 4,
        color: "#c9302c", fontFamily: "inherit", fontSize: 11,
        padding: "3px 8px", cursor: "pointer",
    },
    badge: {
        fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap",
    },
    commentsToggle: {
        background: "transparent", border: "none", color: "#337ab7",
        fontFamily: "inherit", fontSize: 11.5, padding: "8px 0 0", cursor: "pointer",
    },
    commentsSection: {
        marginTop: 8, paddingTop: 10, borderTop: "1px solid #dddddd",
        display: "flex", flexDirection: "column", gap: 10,
    },
    commentList: {
        listStyle: "none", margin: 0, padding: 0,
        display: "flex", flexDirection: "column", gap: 8,
    },
    commentItem: {
        background: "#f7f7f7", border: "1px solid #dddddd", borderRadius: 4, padding: "8px 10px",
    },
    commentMeta: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 10.5, color: "#888888", marginBottom: 4,
    },
    commentAuthor: { color: "#666666", fontWeight: 700 },
    commentDate: { color: "#999999" },
    commentText: { fontSize: 12.5, color: "#333333", margin: 0, whiteSpace: "pre-wrap" },
    commentForm: { display: "flex", flexDirection: "column", gap: 8 },
    successBox: {
        background: "rgba(92,184,92,0.1)", border: "1px solid rgba(92,184,92,0.4)",
        borderRadius: 4, padding: "8px 10px", color: "#5cb85c", fontSize: 12.5,
    },
    errorBox: {
        background: "rgba(217,83,79,0.1)", border: "1px solid rgba(217,83,79,0.4)",
        borderRadius: 4, padding: "8px 10px", color: "#a94442", fontSize: 12.5, marginBottom: 4,
    },
    errorTag: { color: "#d9534f", fontWeight: 700, marginRight: 4 },
};