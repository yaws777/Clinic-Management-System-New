import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Eye, 
    Upload, 
    X, 
    Search,
    Paperclip,
    AlertCircle,
    ArrowLeft,
    Send
} from 'lucide-react';
import '../../styles/nurse/DocumentIssuance.css';

const DocumentIssuance = () => {
    // Get nurse context passed from NurseLayout Outlet
    const { nurseId } = useOutletContext();

    const [requests, setRequests] = useState([]);
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filter & Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');

    // Modal & Approval Flow states
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isApproving, setIsApproving] = useState(false); // Controls upload step visibility
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    // Fetch All Document Requests
    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://clinic-management-system-new.onrender.com/api/document-requests');
            const data = await response.json();
            if (data.success) {
                setRequests(data.requests);
                setFilteredRequests(data.requests);
            } else {
                setError(data.message || 'Failed to load document requests');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Could not connect to backend server.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    // Filter Logic
    useEffect(() => {
        let result = requests;

        if (statusFilter !== 'All') {
            result = result.filter(r => r.status.toLowerCase() === statusFilter.toLowerCase());
        }

        if (typeFilter !== 'All') {
            result = result.filter(r => r.request_type === typeFilter);
        }

        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            result = result.filter(r => 
                `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
                r.student_id.toLowerCase().includes(term) ||
                r.request_id.toLowerCase().includes(term)
            );
        }

        setFilteredRequests(result);
    }, [searchTerm, statusFilter, typeFilter, requests]);

    // Summary Counts
    const summary = {
        pending: requests.filter(r => r.status === 'Pending').length,
        completed: requests.filter(r => r.status === 'Completed' || r.status === 'Approved').length,
        denied: requests.filter(r => r.status === 'Denied').length
    };

    // Fetch notes for a specific request
    const fetchNotes = async (requestType, requestId) => {
        try {
            const res = await fetch(`https://clinic-management-system-new.onrender.com/api/document-requests/notes/${requestType}/${requestId}`);
            const data = await res.json();
            if (data.success) {
                setNotes(data.notes);
            }
        } catch (err) {
            console.error("Error fetching notes:", err);
        }
    };

    // Open Request Details Modal
    const handleViewDetails = async (reqItem) => {
        setSelectedRequest(reqItem);
        setIsApproving(false); // Reset upload step state
        setNewNote('');
        setSelectedFile(null);
        setModalError('');
        
        await fetchNotes(reqItem.request_type, reqItem.request_id);
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setIsApproving(false);
        setNotes([]);
        setNewNote('');
        setSelectedFile(null);
        setModalError('');
    };

    // Send Standalone Message / Note
    const handleSendMessage = async () => {
        if (!newNote.trim()) return;

        if (!nurseId) {
            setModalError('Nurse ID missing from layout context.');
            return;
        }

        setSubmitting(true);
        setModalError('');

        try {
            const response = await fetch('https://clinic-management-system-new.onrender.com/api/document-requests/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    request_id: selectedRequest.request_id,
                    request_type: selectedRequest.request_type,
                    sender_id: nurseId,
                    sender_type: 'Nurse',
                    message: newNote,
                }),
            });

            const result = await response.json();
            if (result.success) {
                setNewNote('');
                await fetchNotes(selectedRequest.request_type, selectedRequest.request_id);
            } else {
                setModalError(result.message || 'Failed to send message.');
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setModalError('Network error occurred while sending message.');
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Action (Approve or Deny)
    const handleAction = async (actionType) => {
        if (!nurseId) {
            setModalError('Nurse ID missing from layout context.');
            return;
        }

        if (actionType === 'Approve' && !selectedFile) {
            setModalError('Please upload an issued document file to approve.');
            return;
        }

        setSubmitting(true);
        setModalError('');

        const formData = new FormData();
        formData.append('request_id', selectedRequest.request_id);
        formData.append('request_type', selectedRequest.request_type);
        formData.append('action', actionType);
        formData.append('nurse_id', nurseId);
        formData.append('message', newNote);
        if (selectedFile) {
            formData.append('issued_slip', selectedFile);
        }

        try {
            const response = await fetch('https://clinic-management-system-new.onrender.com/api/document-requests/action', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            if (result.success) {
                closeModal();
                fetchRequests();
            } else {
                setModalError(result.message || 'Failed to submit action.');
            }
        } catch (err) {
            console.error('Error submitting action:', err);
            setModalError('Network error occurred while submitting.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="doc-issuance-container">
            {/* Page Header */}
            <div className="doc-header">
                <div>
                    <h2>Document Issuance</h2>
                    <p>Review, approve, and issue Excuse Slips and Referral Slips for students.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="doc-summary-cards">
                <div className="summary-card pending-card">
                    <div className="card-icon">
                        <Clock size={28} />
                    </div>
                    <div className="card-info">
                        <span>Pending Requests</span>
                        <h3>{summary.pending}</h3>
                    </div>
                </div>

                <div className="summary-card approved-card">
                    <div className="card-icon">
                        <CheckCircle2 size={28} />
                    </div>
                    <div className="card-info">
                        <span>Completed / Approved</span>
                        <h3>{summary.completed}</h3>
                    </div>
                </div>

                <div className="summary-card denied-card">
                    <div className="card-icon">
                        <XCircle size={28} />
                    </div>
                    <div className="card-info">
                        <span>Denied Requests</span>
                        <h3>{summary.denied}</h3>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="doc-controls">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search by student name, Student ID, or Request ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="All">All Request Types</option>
                        <option value="Excuse Slip">Excuse Slip</option>
                        <option value="Referral Slip">Referral Slip</option>
                    </select>

                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Denied">Denied</option>
                    </select>
                </div>
            </div>

            {/* Document Requests Table */}
            <div className="table-responsive">
                {loading ? (
                    <div className="doc-loading">Loading requests...</div>
                ) : error ? (
                    <div className="doc-error">{error}</div>
                ) : filteredRequests.length === 0 ? (
                    <div className="doc-empty">No document requests found.</div>
                ) : (
                    <table className="doc-table">
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Student Name</th>
                                <th>Request Type</th>
                                <th>Reason / Facility</th>
                                <th>Date Requested</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map((req) => (
                                <tr key={`${req.request_type}-${req.request_id}`}>
                                    <td className="font-bold">{req.request_id}</td>
                                    <td>
                                        <div className="student-info-cell">
                                            <span className="student-name">{req.first_name} {req.last_name}</span>
                                            <span className="student-id">{req.student_id}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge-type ${req.request_type === 'Excuse Slip' ? 'badge-excuse' : 'badge-referral'}`}>
                                            {req.request_type}
                                        </span>
                                    </td>
                                    <td className="truncate-cell">
                                        {req.request_type === 'Excuse Slip' ? req.reason : req.partner_facility_name || req.reason}
                                    </td>
                                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`badge-status status-${req.status.toLowerCase()}`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-view" onClick={() => handleViewDetails(req)}>
                                            <Eye size={15} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Request Detail & Process Modal */}
            {selectedRequest && (
                <div className="doc-modal-overlay">
                    <div className="doc-modal">
                        <div className="modal-header">
                            <div>
                                <h3>Document Request Details</h3>
                                <span className="modal-subtitle">Request ID: {selectedRequest.request_id}</span>
                            </div>
                            <button className="btn-close" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Student Profile Overview */}
                            <div className="details-grid">
                                <div className="detail-item">
                                    <label>Student Name</label>
                                    <p>{selectedRequest.first_name} {selectedRequest.last_name}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Student ID</label>
                                    <p>{selectedRequest.student_id}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Program & Year</label>
                                    <p>{selectedRequest.program_id} - Year {selectedRequest.year_level}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Request Type</label>
                                    <p className="font-bold text-sti-blue">{selectedRequest.request_type}</p>
                                </div>
                            </div>

                            <hr className="modal-divider" />

                            {/* Type Specific Info */}
                            <div className="request-specific-details">
                                <h4>Request Details</h4>
                                {selectedRequest.request_type === 'Excuse Slip' ? (
                                    <>
                                        <p><strong>Reason for Excuse:</strong> {selectedRequest.reason}</p>
                                        <p>
                                            <strong>Valid Absence Period:</strong> {' '}
                                            {selectedRequest.valid_absence_start ? new Date(selectedRequest.valid_absence_start).toLocaleDateString() : 'N/A'} 
                                            {' to '} 
                                            {selectedRequest.valid_absence_end ? new Date(selectedRequest.valid_absence_end).toLocaleDateString() : 'N/A'}
                                        </p>
                                        {selectedRequest.student_proof_url && (
                                            <div className="file-attachment">
                                                <Paperclip size={16} />
                                                <a href={`https://clinic-management-system-new.onrender.com${selectedRequest.student_proof_url}`} target="_blank" rel="noreferrer">
                                                    View Student Attachment Proof
                                                </a>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <p><strong>Reason for Referral:</strong> {selectedRequest.reason}</p>
                                        <p><strong>Partner Facility Name:</strong> {selectedRequest.partner_facility_name || 'N/A'}</p>
                                    </>
                                )}
                            </div>

                            {/* Message / Notes Section */}
                            <div className="modal-notes-section">
                                <h4>Message & Notes History</h4>
                                <div className="notes-list">
                                    {notes.length === 0 ? (
                                        <p className="no-notes">No previous messages or notes attached.</p>
                                    ) : (
                                        notes.map((note) => (
                                            <div key={note.note_id} className={`note-bubble ${note.sender_type === 'Nurse' ? 'note-nurse' : 'note-student'}`}>
                                                <div className="note-header">
                                                    <strong>{note.sender_type} ({note.sender_id})</strong>
                                                    <span>{new Date(note.created_at).toLocaleString()}</span>
                                                </div>
                                                <p>{note.message}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Send Message Input (Always available regardless of request status) */}
                                <div className="message-input-container">
                                    <input 
                                        type="text" 
                                        placeholder="Type a message or instruction..." 
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        disabled={submitting}
                                    />
                                    <button 
                                        type="button" 
                                        className="btn-send-message" 
                                        onClick={handleSendMessage}
                                        disabled={submitting || !newNote.trim()}
                                        title="Send Message"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Process Action Section */}
                            {selectedRequest.status === 'Pending' ? (
                                <div className="action-form">
                                    {!isApproving ? (
                                        /* Initial Step: Approve / Deny Buttons */
                                        <>
                                            <h4>Process Pending Request</h4>

                                            {modalError && (
                                                <div className="modal-error">
                                                    <AlertCircle size={16} /> {modalError}
                                                </div>
                                            )}

                                            <div className="modal-actions">
                                                <button 
                                                    className="btn-approve" 
                                                    onClick={() => setIsApproving(true)}
                                                >
                                                    <CheckCircle2 size={16} /> Approve Request
                                                </button>
                                                <button 
                                                    className="btn-deny" 
                                                    onClick={() => handleAction('Deny')} 
                                                    disabled={submitting}
                                                >
                                                    <XCircle size={16} /> {submitting ? 'Processing...' : 'Deny Request'}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        /* Step 2: Attachment Upload Section (Appears ONLY AFTER clicking Approve) */
                                        <div className="upload-step-box">
                                            <div className="upload-step-header">
                                                <Upload size={20} className="upload-icon-heading" />
                                                <div>
                                                    <h4>Upload Issued Document</h4>
                                                    <p>Attach the issued document file to complete and finalize the request.</p>
                                                </div>
                                            </div>

                                            {modalError && (
                                                <div className="modal-error">
                                                    <AlertCircle size={16} /> {modalError}
                                                </div>
                                            )}

                                            <div className="form-group mt-3">
                                                <label>Upload Document Slip File (PDF, PNG, JPG): <span className="text-danger">*</span></label>
                                                <input 
                                                    type="file" 
                                                    accept=".pdf,.png,.jpg,.jpeg"
                                                    onChange={(e) => setSelectedFile(e.target.files[0])}
                                                />
                                            </div>

                                            <div className="modal-actions mt-3">
                                                <button 
                                                    className="btn-approve" 
                                                    onClick={() => handleAction('Approve')} 
                                                    disabled={submitting}
                                                >
                                                    <Send size={16} /> {submitting ? 'Submitting File...' : 'Submit File & Complete'}
                                                </button>
                                                <button 
                                                    className="btn-secondary" 
                                                    onClick={() => setIsApproving(false)}
                                                    disabled={submitting}
                                                >
                                                    <ArrowLeft size={16} /> Back
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="issued-info-box">
                                    <p><strong>Processed By Nurse ID:</strong> {selectedRequest.issued_by || 'N/A'}</p>
                                    <p><strong>Processed At:</strong> {selectedRequest.issued_at ? new Date(selectedRequest.issued_at).toLocaleString() : 'N/A'}</p>
                                    {selectedRequest.issued_slip_url && (
                                        <div className="file-attachment mt-2">
                                            <Paperclip size={16} />
                                            <a href={`https://clinic-management-system-new.onrender.com${selectedRequest.issued_slip_url}`} target="_blank" rel="noreferrer">
                                                View Official Issued Document
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentIssuance;