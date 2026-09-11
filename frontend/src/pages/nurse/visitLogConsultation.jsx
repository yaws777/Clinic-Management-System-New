import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, User, Activity, ShieldAlert, Clock, XCircle, Eye } from 'lucide-react';
import '../../styles/nurse/VisitLogConsultation.css';

const MEASURED_UNITS = ['mg', 'g', 'mcg', 'mL', 'L'];

const VisitLogConsultation = () => {
    const { nurseId } = useOutletContext();

    const [students, setStudents] = useState([]);
    const [complaints, setComplaints] = useState([]);
    const [batches, setBatches] = useState([]);
    const [history, setHistory] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [inlineTimeouts, setInlineTimeouts] = useState({});
    
    const [selectedViewLog, setSelectedViewLog] = useState(null);
    const [modalTimeOut, setModalTimeOut] = useState('');

    const [formData, setFormData] = useState({
        complaint_id: '',
        visit_date: new Date().toISOString().split('T')[0],
        time_in: '',
        time_out: '',
        temperature: '',
        respiratory_rate: '',
        pulse_rate: '',
        blood_pressure: '',
        nursing_intervention: '',
        health_advice: '',
        batch_id: '',
        dosage_consumption_unit_value: '',
        dosage_consumption_unit_of_measure: ''
    });

    useEffect(() => {
        fetchComplaints();
        fetchBatches();
        fetchHistory();
    }, []);

    const fetchComplaints = async () => {
        try {
            const res = await fetch('https://clinic-management-system-new.onrender.com/api/chief-complaints');
            const data = await res.json();
            setComplaints(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error("Error fetching complaints:", err); 
            setComplaints([]);
        }
    };

    const fetchBatches = async () => {
        try {
            const res = await fetch('https://clinic-management-system-new.onrender.com/api/inventory/batches');
            const data = await res.json();
            setBatches(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error("Error fetching inventory:", err); 
            setBatches([]);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch('https://clinic-management-system-new.onrender.com/api/clinic-visits');
            const data = await res.json();
            setHistory(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error("Error fetching logs:", err); 
            setHistory([]); 
        }
    };

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.trim().length === 0) {
            setStudents([]);
            return;
        }
        try {
            const res = await fetch(`https://clinic-management-system-new.onrender.com/api/students/search?query=${val}`);
            const data = await res.json();
            setStudents(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error("Error during search:", err); 
            setStudents([]);
        }
    };

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); 
        
        setFormData({
            ...formData,
            time_in: currentTime,
            time_out: '',
            complaint_id: '',
            temperature: '',
            respiratory_rate: '',
            pulse_rate: '',
            blood_pressure: '',
            nursing_intervention: '',
            health_advice: '',
            batch_id: '',
            dosage_consumption_unit_value: '',
            dosage_consumption_unit_of_measure: ''
        });
        setStudents([]);
        setSearchQuery('');
        setShowModal(true);
    };

    const handleBatchChange = (batchId) => {
        const selected = batches.find(b => b.batch_id === batchId);
        if (selected) {
            const medicineUnit = selected.avg_dosage_unit_of_measure 
                || selected.avg_dosage_consumption_unit_of_measure 
                || selected.strength_unit_of_measure 
                || 'Tablet/s';

            let rawValue = selected.avg_dosage_value || selected.avg_dosage_consumption_value;
            let initialValue = (rawValue && parseFloat(rawValue) > 0) ? String(rawValue) : '1';
            
            if (!MEASURED_UNITS.includes(medicineUnit) && initialValue) {
                initialValue = String(Math.max(1, Math.floor(Number(initialValue))));
            }

            setFormData({
                ...formData,
                batch_id: batchId,
                dosage_consumption_unit_of_measure: medicineUnit,
                dosage_consumption_unit_value: initialValue
            });
        } else {
            setFormData({
                ...formData,
                batch_id: '',
                dosage_consumption_unit_value: '',
                dosage_consumption_unit_of_measure: ''
            });
        }
    };

    const activeBatchInfo = batches.find(b => b.batch_id === formData.batch_id);
    const isMeasuredUnit = MEASURED_UNITS.includes(formData.dosage_consumption_unit_of_measure);
    const valueFieldLabel = isMeasuredUnit 
        ? `Dosage Value (${formData.dosage_consumption_unit_of_measure})` 
        : 'Quantity Dispensed';

    const calculatedTotalAvailableVolume = activeBatchInfo && isMeasuredUnit
        ? (parseInt(activeBatchInfo.current_stock, 10) > 0 
            ? parseFloat(activeBatchInfo.remaining_volume) + (parseInt(activeBatchInfo.current_stock, 10) - 1) * parseFloat(activeBatchInfo.strength_unit_value || 0)
            : 0)
        : 0;

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (formData.batch_id && formData.dosage_consumption_unit_value) {
            const val = Number(formData.dosage_consumption_unit_value);

            if (isNaN(val) || val <= 0) {
                alert(`${valueFieldLabel} must be a positive number greater than 0.`);
                return;
            }

            if (!isMeasuredUnit && !Number.isInteger(val)) {
                alert(`Quantity Dispensed for discrete units (${formData.dosage_consumption_unit_of_measure}) must be a whole integer without decimals.`);
                return;
            }

            if (activeBatchInfo) {
                const isExpired = new Date(activeBatchInfo.expiration_date) < new Date();
                if (isExpired) {
                    alert('Cannot dispense medicine from an expired batch.');
                    return;
                }

                if (isMeasuredUnit) {
                    if (val > calculatedTotalAvailableVolume) {
                        alert(`Requested volume (${val} ${formData.dosage_consumption_unit_of_measure}) exceeds total available batch volume across stock (${calculatedTotalAvailableVolume} ${formData.dosage_consumption_unit_of_measure}).`);
                        return;
                    }
                } else {
                    const currentStock = parseInt(activeBatchInfo.current_stock, 10);
                    if (val > currentStock) {
                        alert(`Requested quantity (${val}) exceeds available batch stock count (${currentStock}).`);
                        return;
                    }
                }
            }
        }

        const submissionPayload = {
            ...formData,
            student_id: selectedStudent.student_id,
            nurse_id: nurseId || 'NURSE-DEFAULT'
        };

        try {
            const res = await fetch('http://localhost:3001/api/clinic-visits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionPayload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Consultation record logged successfully!');
                setShowModal(false);
                fetchHistory();
                fetchBatches(); 
            } else {
                alert(`Operation failure: ${data.error || 'Unknown error occurred.'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to backend application.');
        }
    };

    const handleUpdateTimeout = async (visitId, customTimeOut = null) => {
        const timeOutVal = customTimeOut || inlineTimeouts[visitId];
        if (!timeOutVal) {
            alert('Please select a valid time-out timestamp before processing updates.');
            return;
        }

        try {
            const res = await fetch(`http://localhost:3001/api/clinic-visits/${visitId}/timeout`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time_out: timeOutVal })
            });
            const data = await res.json();
            if (data.success) {
                alert('Time Out recorded permanently.');
                fetchHistory();
                if (selectedViewLog) {
                    setSelectedViewLog({ ...selectedViewLog, time_out: timeOutVal });
                }
            } else {
                alert(`Error encountered: ${data.error || 'Could not update record.'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed updating timeout values.');
        }
    };

    return (
        <div className="consultation-wrapper">
            <div className="consultation-header-panel">
                <h2>Clinic Visit Consultation Log</h2>
                <p>Track student campus check-ins, record vitals, and safely manage medicine logs.</p>
            </div>

            <div className="search-card-container">
                <label className="input-group-label">Search Student Entity</label>
                <div className="search-input-inner">
                    <Search className="search-inside-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Search student by entering Student ID, First Name, or Last Name..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

                {students.length > 0 && (
                    <div className="search-results-overlay-panel">
                        {students.map((st) => (
                            <div key={st.student_id} className="search-result-row" onClick={() => handleSelectStudent(st)}>
                                <div className="result-avatar"><User size={16} /></div>
                                <div className="result-info">
                                    <span className="result-name">{st.first_name} {st.last_name}</span>
                                    <span className="result-meta">ID: {st.student_id} | {st.program_id || 'No Program'} - Year {st.year_level}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && selectedStudent && (
                <div className="modal-viewport-backdrop">
                    <div className="modal-body-container">
                        <div className="modal-header-accent">
                            <h3>Consultation Documentation Entry</h3>
                            <button className="modal-dismiss-btn" onClick={() => setShowModal(false)}><XCircle size={22} /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="modal-form-scrollable">
                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><User size={16} /> Student Information</h4>
                                <div className="form-fields-grid-layout">
                                    <div className="form-input-element">
                                        <label>Full Name</label>
                                        <input type="text" readOnly value={`${selectedStudent.first_name} ${selectedStudent.last_name}`} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Student ID</label>
                                        <input type="text" readOnly value={selectedStudent.student_id} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Date of Visit</label>
                                        <input type="date" readOnly value={formData.visit_date} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Course Program</label>
                                        <input type="text" readOnly value={selectedStudent.program_id || 'N/A'} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Year Level</label>
                                        <input type="text" readOnly value={selectedStudent.year_level} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Time In</label>
                                        <input type="time" required value={formData.time_in} onChange={e => setFormData({...formData, time_in: e.target.value})} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Time Out <span className="label-optional">(Optional)</span></label>
                                        <input type="time" value={formData.time_out} onChange={e => setFormData({...formData, time_out: e.target.value})} />
                                    </div>
                                    <div className="form-input-element full-width-field">
                                        <label>Reason of Visit / Chief Complaint</label>
                                        <select required value={formData.complaint_id} onChange={e => setFormData({...formData, complaint_id: e.target.value})}>
                                            <option value="">-- Choose matching complaints --</option>
                                            {complaints.map(c => (
                                                <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><Activity size={16} /> Vital Signs</h4>
                                <div className="form-fields-grid-layout four-col-layout">
                                    <div className="form-input-element">
                                        <label>Blood Pressure (mmHg)</label>
                                        <input 
                                            type="text" 
                                            placeholder="120/80" 
                                            pattern="^\d{2,3}\/\d{2,3}$"
                                            title="Enter blood pressure in format SYS/DIA (e.g. 120/80)"
                                            value={formData.blood_pressure} 
                                            onChange={e => setFormData({...formData, blood_pressure: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Temperature (°C)</label>
                                        <input 
                                            type="number" 
                                            step="0.1" 
                                            min="30" 
                                            max="45" 
                                            placeholder="36.5" 
                                            value={formData.temperature} 
                                            onChange={e => setFormData({...formData, temperature: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Pulse Rate (bpm)</label>
                                        <input 
                                            type="number" 
                                            min="30" 
                                            max="250" 
                                            placeholder="72" 
                                            value={formData.pulse_rate} 
                                            onChange={e => setFormData({...formData, pulse_rate: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Respiratory Rate (cpm)</label>
                                        <input 
                                            type="number" 
                                            min="8" 
                                            max="60" 
                                            placeholder="18" 
                                            value={formData.respiratory_rate} 
                                            onChange={e => setFormData({...formData, respiratory_rate: e.target.value})} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><ShieldAlert size={16} /> Intervention & Treatment</h4>
                                <div className="form-fields-grid-layout">
                                    <div className="form-input-element full-width-field">
                                        <label>Nursing Intervention</label>
                                        <textarea rows={2} placeholder="Describe interventions applied..." value={formData.nursing_intervention} onChange={e => setFormData({...formData, nursing_intervention: e.target.value})} />
                                    </div>
                                    <div className="form-input-element full-width-field">
                                        <label>Health Advice</label>
                                        <textarea rows={2} placeholder="Counseling notes given..." value={formData.health_advice} onChange={e => setFormData({...formData, health_advice: e.target.value})} />
                                    </div>

                                    <div className="form-input-element full-width-field">
                                        <label>Dispense Medicine</label>
                                        <select value={formData.batch_id} onChange={e => handleBatchChange(e.target.value)}>
                                            <option value="">-- No medication needed / select medicine --</option>
                                            {batches.map(b => {
                                                const isExpired = new Date(b.expiration_date) < new Date();
                                                return (
                                                    <option key={b.batch_id} value={b.batch_id} disabled={isExpired}>
                                                        {b.medicine_name} {isExpired ? '(EXPIRED)' : `(Stock: ${b.current_stock} | Open Vol: ${b.remaining_volume} | Exp: ${new Date(b.expiration_date).toLocaleDateString()})`}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {formData.batch_id && (
                                        <>
                                            <div className="form-input-element">
                                                <label>{valueFieldLabel}</label>
                                                <input 
                                                    type="number" 
                                                    step={isMeasuredUnit ? "any" : "1"}
                                                    min={isMeasuredUnit ? "0.01" : "1"}
                                                    required
                                                    value={formData.dosage_consumption_unit_value}
                                                    onKeyDown={(e) => {
                                                        if (!isMeasuredUnit && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E')) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    onChange={e => {
                                                        let inputVal = e.target.value;
                                                        if (!isMeasuredUnit) {
                                                            inputVal = inputVal.replace(/[^0-9]/g, '');
                                                        }
                                                        setFormData({...formData, dosage_consumption_unit_value: inputVal});
                                                    }} 
                                                />
                                                {activeBatchInfo && (
                                                    <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                                                        {isMeasuredUnit 
                                                            ? `Open Vol: ${activeBatchInfo.remaining_volume} ${formData.dosage_consumption_unit_of_measure} | Total Batch Stock Vol: ${calculatedTotalAvailableVolume} ${formData.dosage_consumption_unit_of_measure}` 
                                                            : `Available Count: ${activeBatchInfo.current_stock} units`}
                                                    </small>
                                                )}
                                            </div>
                                            <div className="form-input-element">
                                                <label>Unit of Measure</label>
                                                <input 
                                                    type="text" 
                                                    readOnly 
                                                    value={formData.dosage_consumption_unit_of_measure} 
                                                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="modal-action-footer">
                                <button type="button" className="btn-cancel-action" onClick={() => setShowModal(false)}>Discard</button>
                                <button type="submit" className="btn-confirm-action">Confirm Documentation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedViewLog && (
                <div className="modal-viewport-backdrop">
                    <div className="modal-body-container">
                        <div className="modal-header-accent">
                            <h3>Visit Log Details</h3>
                            <button className="modal-dismiss-btn" onClick={() => setSelectedViewLog(null)}><XCircle size={22} /></button>
                        </div>
                        
                        <div className="modal-form-scrollable" style={{ padding: '20px' }}>
                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><User size={16} /> Student & Visit Info</h4>
                                <div className="form-fields-grid-layout">
                                    <div className="form-input-element">
                                        <label>Full Name</label>
                                        <input type="text" readOnly value={`${selectedViewLog.first_name} ${selectedViewLog.last_name}`} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Student ID</label>
                                        <input type="text" readOnly value={selectedViewLog.student_id} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Complaint</label>
                                        <input type="text" readOnly value={selectedViewLog.complaint_name || 'N/A'} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Date of Visit</label>
                                        <input type="text" readOnly value={new Date(selectedViewLog.visit_date).toLocaleDateString()} />
                                    </div>
                                    
                                    <div className="form-input-element">
                                        <label>Time In</label>
                                        <input type="time" readOnly value={selectedViewLog.time_in} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Time Out</label>
                                        {selectedViewLog.time_out ? (
                                            <input type="time" readOnly value={selectedViewLog.time_out} />
                                        ) : (
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="time" value={modalTimeOut} onChange={(e) => setModalTimeOut(e.target.value)} />
                                                <button className="btn-confirm-action" style={{ padding: '0 10px', whiteSpace: 'nowrap' }} onClick={() => handleUpdateTimeout(selectedViewLog.visit_id, modalTimeOut)}>Save</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><ShieldAlert size={16} /> Dispensation Details</h4>
                                <div className="form-fields-grid-layout">
                                    <div className="form-input-element full-width-field">
                                        {selectedViewLog.medicine_name ? (
                                            <div style={{ padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                                <strong>Medicine Dispensed:</strong> {selectedViewLog.medicine_name} <br/>
                                                <strong>
                                                    {MEASURED_UNITS.includes(selectedViewLog.dosage_consumption_unit_of_measure) 
                                                        ? `Dosage Value (${selectedViewLog.dosage_consumption_unit_of_measure}):` 
                                                        : 'Quantity Dispensed:'}
                                                </strong> {selectedViewLog.dosage_consumption_unit_value} {selectedViewLog.dosage_consumption_unit_of_measure} <br/>
                                                <small style={{ color: '#64748b' }}>Dispensed at: {new Date(selectedViewLog.dispensed_at).toLocaleString()}</small>
                                            </div>
                                        ) : (
                                            <p style={{ color: '#64748b', fontStyle: 'italic' }}>No medication was dispensed during this visit.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="history-table-section-card">
                <div className="section-title-wrapper">
                    <Clock size={18} className="title-icon-accent" />
                    <h3>Clinic Visit History Logs</h3>
                </div>
                
                <div className="table-overflow-scroller">
                    <table className="styled-history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Student Identity</th>
                                <th>Complaint</th>
                                <th>Vitals</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-table-state">No current records available in system files.</td>
                                </tr>
                            ) : (
                                history.map((log) => {
                                    const isTimeoutLocked = log.time_out !== null && log.time_out !== "";
                                    
                                    return (
                                        <tr key={log.visit_id} className={isTimeoutLocked ? "row-locked" : "row-active"}>
                                            <td><strong>{new Date(log.visit_date).toLocaleDateString()}</strong></td>
                                            <td>
                                                <div className="table-profile-cell">
                                                    <span>{log.first_name} {log.last_name}</span>
                                                    <small>{log.student_id}</small>
                                                </div>
                                            </td>
                                            <td><span className="complaint-badge">{log.complaint_name || 'N/A'}</span></td>
                                            <td>
                                                <div className="vitals-compressed-row">
                                                    <span>{log.blood_pressure || '--'}</span> | 
                                                    <span> {log.temperature ? `${log.temperature}°C` : '--'}</span> | 
                                                    <span> {log.pulse_rate || '--'}</span> | 
                                                    <span> {log.respiratory_rate || '--'}</span>
                                                </div>
                                            </td>
                                            <td>{log.time_in}</td>
                                            <td>
                                                {isTimeoutLocked ? (
                                                    <span className="timestamp-locked-badge">{log.time_out}</span>
                                                ) : (
                                                    <input 
                                                        type="time" 
                                                        className="table-inline-time-input"
                                                        value={inlineTimeouts[log.visit_id] || ""} 
                                                        onChange={(e) => setInlineTimeouts({
                                                            ...inlineTimeouts,
                                                            [log.visit_id]: e.target.value
                                                        })}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button 
                                                        type="button" 
                                                        className="action-view-btn"
                                                        style={{ background: '#3b82f6', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => {
                                                            setSelectedViewLog(log);
                                                            setModalTimeOut('');
                                                        }}
                                                    >
                                                        <Eye size={14} /> View
                                                    </button>

                                                    {!isTimeoutLocked && (
                                                        <button 
                                                            type="button" 
                                                            className="action-save-timeout-btn"
                                                            onClick={() => handleUpdateTimeout(log.visit_id)}
                                                        >
                                                            Save Exit
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VisitLogConsultation;