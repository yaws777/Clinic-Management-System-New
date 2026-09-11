import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import '../../styles/student/RequestModule.css';

// API Base URL Configuration (Render primary, Localhost secondary)
const RENDER_BASE_URL = 'https://clinic-management-system-new.onrender.com';
const LOCALHOST_BASE_URL = 'http://localhost:3000';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? LOCALHOST_BASE_URL
    : (RENDER_BASE_URL || LOCALHOST_BASE_URL);

const API_BASE = `${API_BASE_URL}/api/requests`;

export default function RequestModule() {
  // Extract studentId directly from StudentLayout context
  const { studentId, firstName, lastName } = useOutletContext() || {};
  const student_id = studentId;

  // UI state
  const [activeModal, setActiveModal] = useState(null); // 'excuse' | 'referral' | 'view' | null
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Form States
  const [excuseForm, setExcuseForm] = useState({
    reason_for_excuse: '',
    valid_absence_start: '',
    valid_absence_end: '',
    proof: null
  });

  const [referralForm, setReferralForm] = useState({
    reason_for_referral: '',
    partner_facility_name: 'Premiere Laboratory(Partner Lab)'
  });

  // Fetch Requests for logged-in student (Memoized with useCallback)
  const fetchRequests = useCallback(async () => {
    if (!student_id) return;
    try {
      const res = await fetch(`${API_BASE}/student/${student_id}`);
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    }
  }, [student_id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch Notes for selected request
  const fetchNotes = async (reqItem) => {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(reqItem.request_type)}/${reqItem.request_id}/notes`);
      const data = await res.json();
      setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  // Submit Excuse Slip Request
  const handleExcuseSubmit = async (e) => {
    e.preventDefault();
    if (!student_id) {
      alert('Student ID not found. Please log in again.');
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append('student_id', student_id);
    formData.append('reason_for_excuse', excuseForm.reason_for_excuse);
    formData.append('valid_absence_start', excuseForm.valid_absence_start);
    formData.append('valid_absence_end', excuseForm.valid_absence_end);
    if (excuseForm.proof) {
      formData.append('proof', excuseForm.proof);
    }

    try {
      const res = await fetch(`${API_BASE}/excuse-slip`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setExcuseForm({ reason_for_excuse: '', valid_absence_start: '', valid_absence_end: '', proof: null });
        setActiveModal(null);
        fetchRequests();
      }
    } catch (err) {
      console.error('Error submitting excuse request:', err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Referral Slip Request
  const handleReferralSubmit = async (e) => {
    e.preventDefault();
    if (!student_id) {
      alert('Student ID not found. Please log in again.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/referral-slip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id,
          ...referralForm
        })
      });
      if (res.ok) {
        setReferralForm({ reason_for_referral: '', partner_facility_name: 'Premiere Laboratory(Partner Lab)' });
        setActiveModal(null);
        fetchRequests();
      }
    } catch (err) {
      console.error('Error submitting referral request:', err);
    } finally {
      setLoading(false);
    }
  };

  // View Details Modal Trigger
  const handleViewDetails = (reqItem) => {
    setSelectedRequest(reqItem);
    setActiveModal('view');
    fetchNotes(reqItem);
  };

  // Send Note/Message
  const handleSendNote = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRequest) return;

    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(selectedRequest.request_type)}/${selectedRequest.request_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_type: 'Student',
          sender_id: student_id,
          message: newMessage
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchNotes(selectedRequest);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <div className="sti-req-container">
      <div className="sti-header-banner">
        <h2 className="sti-page-title">Document Requests</h2>
        {firstName && <p className="sti-welcome-text">Welcome, {firstName} {lastName} ({student_id})</p>}
      </div>

      {/* Action Cards */}
      <div className="sti-cards-grid">
        <div className="sti-action-card" onClick={() => setActiveModal('excuse')}>
          <div className="sti-card-icon">📄</div>
          <h3>Request Excuse Slip</h3>
          <p>Submit an excuse slip for missed classes or school activities.</p>
          <button className="sti-btn-primary">New Request</button>
        </div>

        <div className="sti-action-card" onClick={() => setActiveModal('referral')}>
          <div className="sti-card-icon">🏥</div>
          <h3>Request Referral Slip</h3>
          <p>Request medical or laboratory referral for partner facilities.</p>
          <button className="sti-btn-primary">New Request</button>
        </div>
      </div>

      {/* Request History */}
      <div className="sti-table-card">
        <h3>Request History</h3>
        <table className="sti-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Request Type</th>
              <th>Details</th>
              <th>Date Requested</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>No request history found.</td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.request_id}>
                  <td><strong>{req.request_id}</strong></td>
                  <td>
                    <span className={`sti-badge ${req.request_type === 'Excuse Slip' ? 'badge-excuse' : 'badge-referral'}`}>
                      {req.request_type}
                    </span>
                  </td>
                  <td>
                    {req.request_type === 'Excuse Slip'
                      ? req.reason_for_excuse
                      : `${req.reason_for_referral} (${req.partner_facility_name})`}
                  </td>
                  <td>{new Date(req.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`sti-status status-${req.status ? req.status.toLowerCase() : 'pending'}`}>
                      {req.status || 'Pending'}
                    </span>
                  </td>
                  <td>
                    <button className="sti-btn-icon" onClick={() => handleViewDetails(req)} title="View Details">
                      👁️ View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Excuse Slip */}
      {activeModal === 'excuse' && (
        <div className="sti-modal-overlay">
          <div className="sti-modal-content">
            <div className="sti-modal-header">
              <h3>Request Excuse Slip</h3>
              <button className="sti-modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            </div>
            <form onSubmit={handleExcuseSubmit}>
              <div className="sti-form-group">
                <label>Reason for Excuse</label>
                <textarea
                  required
                  rows="3"
                  value={excuseForm.reason_for_excuse}
                  onChange={(e) => setExcuseForm({ ...excuseForm, reason_for_excuse: e.target.value })}
                  placeholder="State the reason for your absence..."
                />
              </div>

              <div className="sti-form-row">
                <div className="sti-form-group">
                  <label>Valid Absence Start Date</label>
                  <input
                    type="date"
                    required
                    value={excuseForm.valid_absence_start}
                    onChange={(e) => setExcuseForm({ ...excuseForm, valid_absence_start: e.target.value })}
                  />
                </div>
                <div className="sti-form-group">
                  <label>Valid Absence End Date</label>
                  <input
                    type="date"
                    required
                    value={excuseForm.valid_absence_end}
                    onChange={(e) => setExcuseForm({ ...excuseForm, valid_absence_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="sti-form-group">
                <label>Upload Proof (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setExcuseForm({ ...excuseForm, proof: e.target.files[0] })}
                />
              </div>

              <div className="sti-modal-actions">
                <button type="button" className="sti-btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="sti-btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Referral Slip */}
      {activeModal === 'referral' && (
        <div className="sti-modal-overlay">
          <div className="sti-modal-content">
            <div className="sti-modal-header">
              <h3>Request Referral Slip</h3>
              <button className="sti-modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            </div>
            <form onSubmit={handleReferralSubmit}>
              <div className="sti-form-group">
                <label>Reason for Referral</label>
                <textarea
                  required
                  rows="3"
                  value={referralForm.reason_for_referral}
                  onChange={(e) => setReferralForm({ ...referralForm, reason_for_referral: e.target.value })}
                  placeholder="State the reason for medical/lab referral..."
                />
              </div>

              <div className="sti-form-group">
                <label>Partner Facility Name</label>
                <select
                  value={referralForm.partner_facility_name}
                  onChange={(e) => setReferralForm({ ...referralForm, partner_facility_name: e.target.value })}
                >
                  <option value="Premiere Laboratory(Partner Lab)">Premiere Laboratory(Partner Lab)</option>
                </select>
              </div>

              <div className="sti-modal-actions">
                <button type="button" className="sti-btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="sti-btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details & Notes */}
      {activeModal === 'view' && selectedRequest && (
        <div className="sti-modal-overlay">
          <div className="sti-modal-content sti-modal-lg">
            <div className="sti-modal-header">
              <h3>Request Details - {selectedRequest.request_id}</h3>
              <button className="sti-modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            </div>
            
            <div className="sti-details-section">
              <div className="sti-details-grid">
                <p><strong>Type:</strong> {selectedRequest.request_type}</p>
                <p><strong>Status:</strong> {selectedRequest.status || 'Pending'}</p>
                <p><strong>Requested On:</strong> {new Date(selectedRequest.created_at).toLocaleString()}</p>
                
                {selectedRequest.request_type === 'Excuse Slip' ? (
                  <>
                    <p><strong>Reason:</strong> {selectedRequest.reason_for_excuse}</p>
                    <p><strong>Absence Period:</strong> {selectedRequest.valid_absence_start} to {selectedRequest.valid_absence_end}</p>
                    {selectedRequest.student_proof_url && (
                      <p>
                        <strong>Attachment:</strong>{' '}
                        <a href={`${API_BASE_URL}${selectedRequest.student_proof_url}`} target="_blank" rel="noreferrer">
                          View Uploaded Proof
                        </a>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p><strong>Reason:</strong> {selectedRequest.reason_for_referral}</p>
                    <p><strong>Partner Facility:</strong> {selectedRequest.partner_facility_name}</p>
                  </>
                )}

                {selectedRequest.issued_slip_url ? (
                  <p className="sti-issued-link">
                    <strong>Issued Slip Document:</strong>{' '}
                    <a href={`${API_BASE_URL}${selectedRequest.issued_slip_url}`} target="_blank" rel="noreferrer">
                      📄 Download Issued Slip
                    </a>
                  </p>
                ) : (
                  <p className="sti-text-muted">Issued Slip: Not yet issued by Nurse</p>
                )}
              </div>

              <hr className="sti-divider" />

              {/* Notes / Chat Thread */}
              <h4>Messages & Notes</h4>
              <div className="sti-chat-box">
                {notes.length === 0 ? (
                  <p className="sti-text-muted">No notes or messages yet.</p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.note_id}
                      className={`sti-chat-bubble ${n.sender_type === 'Student' ? 'bubble-student' : 'bubble-nurse'}`}
                    >
                      <div className="sti-chat-meta">
                        <strong>{n.sender_type}</strong> • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="sti-chat-msg">{n.message}</div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendNote} className="sti-chat-form">
                <input
                  type="text"
                  placeholder="Type a message or note..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="sti-btn-primary">Send</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}