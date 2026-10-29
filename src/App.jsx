import { useState, useEffect } from 'react'
import './App.css'

const API = 'https://smart-civic-management-backend.onrender.com/api'

// Naya department chahiye to bas yaha ek naam jod do
const DEPARTMENTS = [
  'Garbage',
  'Road',
  'Streetlight',
  'Water',
  'Electricity',
  'Drainage',
  'Housing',
  'Health',
]

const STATUSES = ['PENDING', 'IN_PROGRESS', 'RESOLVED']
const VALID_ROLES = ['CITIZEN', 'ADMIN', 'OFFICER']
const STORAGE_KEY = 'civicUser'

async function getJson(path) {
  const res = await fetch(API + path)
  if (!res.ok) {
    throw new Error('Request failed: ' + res.status)
  }
  return res.json()
}

// Page refresh par login yaad rakhne ke liye
function loadSavedUser() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && saved.id && VALID_ROLES.includes(saved.role)) {
      return saved
    }
  } catch {
    // kharab data ho to ignore karo
  }
  return null
}

function Notice({ notice }) {
  if (!notice) {
    return null
  }
  const colors =
    notice.type === 'error'
      ? { background: '#fdecee', color: '#b42336', border: '1px solid #f5c2c7' }
      : { background: '#e8f6ef', color: '#1e8a5f', border: '1px solid #bfe6d3' }

  return (
    <div
      style={{
        ...colors,
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 600,
        margin: '0 auto 18px auto',
        maxWidth: '420px',
        textAlign: 'center',
      }}
    >
      {notice.text}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(loadSavedUser)
  const [authMode, setAuthMode] = useState('login')
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const [complaints, setComplaints] = useState([])
  const [viewMode, setViewMode] = useState('all')
  const [officers, setOfficers] = useState([])
  const [showComplaintForm, setShowComplaintForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(DEPARTMENTS[0])
  const [location, setLocation] = useState('')

  const [statusSelections, setStatusSelections] = useState({})
  const [assignSelections, setAssignSelections] = useState({})

  // Login ke baad (ya refresh par) data load karo
  useEffect(() => {
    if (!user) {
      return
    }
    let cancelled = false

    async function init() {
      try {
        if (user.role === 'ADMIN') {
          const users = await getJson('/users')
          if (!cancelled) {
            setOfficers(users.filter((u) => u.role === 'OFFICER'))
          }
        }
        const mode = user.role === 'OFFICER' ? 'assigned' : 'all'
        const data =
          mode === 'assigned'
            ? await getJson('/complaints/assigned/' + user.id)
            : await getJson('/complaints')
        if (!cancelled) {
          setComplaints(data)
          setViewMode(mode)
        }
      } catch {
        if (!cancelled) {
          setNotice({
            type: 'error',
            text: 'Could not load data. Please check that the backend is running.',
          })
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [user])

  async function loadComplaints(mode) {
    try {
      let data
      if (mode === 'assigned') {
        data = await getJson('/complaints/assigned/' + user.id)
      } else if (mode === 'mine') {
        data = await getJson('/complaints/user/' + user.id)
      } else {
        data = await getJson('/complaints')
      }
      setComplaints(data)
      setViewMode(mode)
    } catch {
      setNotice({ type: 'error', text: 'Could not load complaints. Please try again.' })
    }
  }

  function switchAuthMode(mode) {
    setAuthMode(mode)
    setNotice(null)
  }

  async function handleLogin(e) {
    e.preventDefault()
    const identifier = loginIdentifier.trim()

    if (!identifier || !loginPassword) {
      setNotice({ type: 'error', text: 'Please enter your email/name and password.' })
      return
    }

    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(API + '/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier, password: loginPassword }),
      })

      if (!res.ok) {
        setNotice({ type: 'error', text: 'Server error. Please try again.' })
        return
      }

      const text = await res.text()
      if (text !== 'Login Successful!') {
        setNotice({ type: 'error', text: 'Invalid email/name or password.' })
        return
      }

      const users = await getJson('/users')
      const lower = identifier.toLowerCase()
      const found =
        users.find((u) => u.email.toLowerCase() === lower) ||
        users.find((u) => u.name.toLowerCase() === lower)

      if (!found) {
        setNotice({ type: 'error', text: 'Could not find your account. Please try again.' })
        return
      }

      const sessionUser = { id: found.id, name: found.name, role: found.role }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
      setLoginPassword('')
      setUser(sessionUser)
    } catch {
      setNotice({
        type: 'error',
        text: 'Cannot reach the server. Please check that the backend is running.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const name = regName.trim()
    const email = regEmail.trim().toLowerCase()

    if (!name) {
      setNotice({ type: 'error', text: 'Please enter your name.' })
      return
    }
    if (!email.includes('@')) {
      setNotice({ type: 'error', text: 'Please enter a valid email.' })
      return
    }
    if (regPassword.length < 6) {
      setNotice({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }

    setBusy(true)
    setNotice(null)
    try {
      // Sign-up se sirf Citizen account banta hai
      const res = await fetch(API + '/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          password: regPassword,
          role: 'CITIZEN',
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setNotice({ type: 'error', text: data.error || 'Registration failed. Please try again.' })
        return
      }

      setNotice({ type: 'success', text: 'Account created! You can now log in.' })
      setLoginIdentifier(email)
      setRegName('')
      setRegEmail('')
      setRegPassword('')
      setAuthMode('login')
    } catch {
      setNotice({
        type: 'error',
        text: 'Cannot reach the server. Please check that the backend is running.',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setComplaints([])
    setOfficers([])
    setViewMode('all')
    setShowComplaintForm(false)
    setStatusSelections({})
    setAssignSelections({})
    setLoginIdentifier('')
    setLoginPassword('')
    setNotice(null)
    setAuthMode('login')
  }

  function handleTab(mode) {
    setNotice(null)
    loadComplaints(mode)
  }

  async function handleAddComplaint(e) {
    e.preventDefault()

    if (!title.trim() || !description.trim() || !location.trim()) {
      setNotice({ type: 'error', text: 'Please fill in the title, description and location.' })
      return
    }

    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(API + '/complaints/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: category,
          location: location.trim(),
          user: { id: user.id },
        }),
      })

      if (!res.ok) {
        setNotice({ type: 'error', text: 'Could not submit your complaint. Please try again.' })
        return
      }

      setTitle('')
      setDescription('')
      setLocation('')
      setCategory(DEPARTMENTS[0])
      setShowComplaintForm(false)
      setNotice({ type: 'success', text: 'Complaint submitted successfully.' })
      await loadComplaints(viewMode)
    } catch {
      setNotice({
        type: 'error',
        text: 'Cannot reach the server. Please check that the backend is running.',
      })
    } finally {
      setBusy(false)
    }
  }

  function clearSelection(setter, id) {
    setter((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleStatusUpdate(c) {
    const newStatus = statusSelections[c.id] || c.status

    if (newStatus === c.status) {
      setNotice({ type: 'error', text: 'Please choose a different status first.' })
      return
    }

    try {
      const res = await fetch(
        `${API}/complaints/${c.id}/status?newStatus=${newStatus}&userId=${user.id}`,
        { method: 'PUT' }
      )
      const text = await res.text()
      setNotice({ type: text.startsWith('Status updated') ? 'success' : 'error', text: text })
      clearSelection(setStatusSelections, c.id)
      await loadComplaints(viewMode)
    } catch {
      setNotice({
        type: 'error',
        text: 'Cannot reach the server. Please check that the backend is running.',
      })
    }
  }

  async function handleAssign(c) {
    const officerId = assignSelections[c.id]

    if (!officerId) {
      setNotice({ type: 'error', text: 'Please select an officer first.' })
      return
    }

    try {
      const res = await fetch(
        `${API}/complaints/${c.id}/assign?staffId=${officerId}&userId=${user.id}`,
        { method: 'PUT' }
      )
      const text = await res.text()
      setNotice({ type: text.includes('successfully') ? 'success' : 'error', text: text })
      clearSelection(setAssignSelections, c.id)
      await loadComplaints(viewMode)
    } catch {
      setNotice({
        type: 'error',
        text: 'Cannot reach the server. Please check that the backend is running.',
      })
    }
  }

  // Status badalne ka control sirf OFFICER ko dikhta hai
  function renderStatusControls(c) {
    return (
      <div className="admin-controls">
        <select
          value={statusSelections[c.id] || c.status}
          onChange={(e) => setStatusSelections({ ...statusSelections, [c.id]: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => handleStatusUpdate(c)}>
          Update
        </button>
      </div>
    )
  }

  // ===================== DASHBOARD =====================
  if (user) {
    const isCitizen = user.role === 'CITIZEN'
    const isAdmin = user.role === 'ADMIN'
    const isOfficer = user.role === 'OFFICER'
    const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U'

    const subtitles = {
      all: 'Viewing all public complaints',
      mine: 'Viewing your complaints only',
      assigned: 'Viewing complaints assigned to you',
    }

    return (
      <div>
        <div className="navbar">
          <h1>Smart Civic Management System</h1>
          <div className="profile-section">
            <div className="profile-info">
              <div className="name">{user.name}</div>
              <span className={'role-badge role-' + user.role}>{user.role}</span>
            </div>
            <div className="avatar-circle" title={user.name}>
              {initial}
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="container">
          <h2>Complaints Dashboard</h2>
          <p className="subtitle">{subtitles[viewMode]}</p>

          <Notice notice={notice} />

          {isCitizen && (
            <div className="tabs">
              <button
                type="button"
                className={viewMode === 'all' ? 'active' : ''}
                onClick={() => handleTab('all')}
              >
                All Complaints (Public)
              </button>
              <button
                type="button"
                className={viewMode === 'mine' ? 'active' : ''}
                onClick={() => handleTab('mine')}
              >
                My Complaints (Private)
              </button>
            </div>
          )}

          {isCitizen && (
            <div className="top-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowComplaintForm(!showComplaintForm)
                  setNotice(null)
                }}
              >
                {showComplaintForm ? 'Cancel' : '+ New Complaint'}
              </button>
            </div>
          )}

          {isCitizen && showComplaintForm && (
            <form className="form-box" onSubmit={handleAddComplaint}>
              <input
                type="text"
                placeholder="Title"
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                placeholder="Description"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Location"
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button type="submit" disabled={busy}>
                {busy ? 'Please wait...' : 'Submit Complaint'}
              </button>
            </form>
          )}

          {complaints.length === 0 ? (
            <div className="empty-state">No complaints found.</div>
          ) : (
            <div className="complaint-grid">
              {complaints.map((c) => {
                const matchingOfficers = officers.filter((o) => o.department === c.category)
                const otherOfficers = officers.filter((o) => o.department !== c.category)

                return (
                  <div key={c.id} className="complaint-card">
                    <div className="complaint-card-header">
                      <span className="complaint-number">
                        {'CMP-' + String(c.id).padStart(3, '0')}
                      </span>
                      <span className={'status-badge status-' + c.status}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3>{c.title}</h3>
                    <p className="description">{c.description}</p>

                    <div className="complaint-meta">
                      <span>
                        <b>Category:</b> <span className="category-chip">{c.category}</span>
                      </span>
                      <span>
                        <b>Location:</b> {c.location}
                      </span>
                      {c.assignedTo && (
                        <span>
                          <b>Assigned To (Officer):</b> {c.assignedTo.name}
                        </span>
                      )}
                    </div>

                    {viewMode === 'all' && (
                      <p className="posted-by">Posted by {c.user ? c.user.name : 'Unknown'}</p>
                    )}

                    {/* ADMIN: sirf officer ko assign ya reassign karta hai */}
                    {isAdmin && (
                      <div className="admin-controls">
                        <select
                          value={assignSelections[c.id] || ''}
                          onChange={(e) =>
                            setAssignSelections({ ...assignSelections, [c.id]: e.target.value })
                          }
                        >
                          <option value="">Select Officer...</option>
                          {matchingOfficers.length > 0 && (
                            <optgroup label={'Recommended (' + c.category + ')'}>
                              {matchingOfficers.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {otherOfficers.length > 0 && (
                            <optgroup label="Other departments">
                              {otherOfficers.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name} ({o.department || 'General'})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <button type="button" onClick={() => handleAssign(c)}>
                          {c.assignedTo ? 'Reassign' : 'Assign'}
                        </button>
                      </div>
                    )}

                    {/* OFFICER: status sirf yahi badalta hai */}
                    {isOfficer && renderStatusControls(c)}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ===================== LOGIN / REGISTER =====================
  return (
    <div className="auth-wrapper">
      <h1 style={{ marginBottom: '20px' }}>Smart Civic Management System</h1>

      {authMode === 'login' ? (
        <div>
          <h2>Login</h2>
          <form className="form-box" onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Email / Name"
              autoComplete="username"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
            />
            <input
              type="password"
              placeholder="Enter Password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Please wait...' : 'Login'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px' }}>
              Don't have an account?{' '}
              <button type="button" className="link-btn" onClick={() => switchAuthMode('register')}>
                Register Here
              </button>
            </p>
          </form>
        </div>
      ) : (
        <div>
          <h2>Register</h2>
          <form className="form-box" onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Enter Name"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
            />
            <input
              type="email"
              placeholder="Enter Email"
              autoComplete="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              autoComplete="new-password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
            />

            <button type="submit" disabled={busy}>
              {busy ? 'Please wait...' : 'Register'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#888' }}>
              Sign-up creates a Citizen account. Officer accounts are created by the admin.
            </p>

            <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '13px' }}>
              Already have an account?{' '}
              <button type="button" className="link-btn" onClick={() => switchAuthMode('login')}>
                Login Here
              </button>
            </p>
          </form>
        </div>
      )}

      <Notice notice={notice} />
    </div>
  )
}

export default App
