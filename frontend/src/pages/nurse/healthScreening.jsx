import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, Plus, Users, Eye, Activity, Smile, 
  X, CheckCircle, Edit3, Trash2, FileText, ArrowLeft, ArrowRight
} from 'lucide-react';
import '../../styles/nurse/HealthScreening.css';

const API_BASE = 'http://localhost:3001/api';

export default function HealthScreening() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);

  // Modal States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStudentSelectModal, setShowStudentSelectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  // Form States
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    screening_type: 'BMI',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    target_program_id: '',
    target_year_level: '',
    target_section: ''
  });

  const [filterStudents, setFilterStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Active Schedule & Selected Student for Documentation
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [scheduleStudents, setScheduleStudents] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Documentation Dynamic Form State
  const [docData, setDocData] = useState({});

  useEffect(() => {
    fetchSchedules();
    fetchPrograms();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_BASE}/screenings`);
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`${API_BASE}/programs`);
      const data = await res.json();
      setPrograms(data);
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  // Fetch Students for Modal Filtering (Memoized to satisfy ESLint)
  const handleFilterStudents = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();

      if (scheduleForm.target_program_id) {
        queryParams.append('program_id', scheduleForm.target_program_id);
      }
      if (scheduleForm.target_year_level) {
        queryParams.append('year_level', scheduleForm.target_year_level);
      }
      if (scheduleForm.target_section) {
        queryParams.append('section', scheduleForm.target_section);
      }

      const res = await fetch(`${API_BASE}/filtered-students?${queryParams.toString()}`);
      const data = await res.json();

      const studentArray = Array.isArray(data) ? data : (data.students || data.data || []);
      setFilterStudents(studentArray);
    } catch (err) {
      console.error('Error filtering students:', err);
      setFilterStudents([]);
    }
  }, [scheduleForm.target_program_id, scheduleForm.target_year_level, scheduleForm.target_section]);

  // Trigger filtering when the Student Selection Modal is open or filters change
  useEffect(() => {
    if (showStudentSelectModal) {
      handleFilterStudents();
    }
  }, [showStudentSelectModal, handleFilterStudents]);

  // Modal Navigation Handlers
  const handleNextToStudents = (e) => {
    e.preventDefault();
    setShowScheduleModal(false);
    setShowStudentSelectModal(true);
  };

  const handleBackToSchedule = () => {
    setShowStudentSelectModal(false);
    setShowScheduleModal(true);
  };

  // Toggle "Select All / Deselect All" for currently filtered students
  const handleSelectAllFiltered = (e) => {
    if (e.target.checked) {
      const filteredIds = filterStudents.map(st => st.student_id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    } else {
      const filteredSet = new Set(filterStudents.map(st => st.student_id));
      setSelectedStudentIds(prev => prev.filter(id => !filteredSet.has(id)));
    }
  };

  const areAllFilteredSelected = filterStudents.length > 0 && 
    filterStudents.every(st => selectedStudentIds.includes(st.student_id));

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/screenings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scheduleForm, student_ids: selectedStudentIds })
      });
      if (res.ok) {
        setShowStudentSelectModal(false);
        resetScheduleForm();
        fetchSchedules();
      }
    } catch (err) {
      console.error('Error creating schedule:', err);
    }
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/screenings/${editingSchedule.screening_schedule_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSchedule)
      });
      if (res.ok) {
        setShowEditModal(false);
        fetchSchedules();
      }
    } catch (err) {
      console.error('Error updating schedule:', err);
    }
  };

  const handleCancelSchedule = async (id) => {
    if (window.confirm('Are you sure you want to cancel this screening? Students will be notified.')) {
      try {
        const res = await fetch(`${API_BASE}/screenings/${id}`, { method: 'DELETE' });
        if (res.ok) fetchSchedules();
      } catch (err) {
        console.error('Error cancelling schedule:', err);
      }
    }
  };

  const openViewModal = async (schedule) => {
    setActiveSchedule(schedule);
    try {
      const res = await fetch(`${API_BASE}/screenings/${schedule.screening_schedule_id}/students`);
      const data = await res.json();
      setScheduleStudents(data.students);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error opening participant list:', err);
    }
  };

  const openDocumentModal = (student) => {
    setSelectedStudent(student);
    setDocData({
      height_cm: student.height_cm || '',
      weight_kg: student.weight_kg || '',
      bmi_value: student.bmi_value || '',
      bmi_category: student.bmi_category || 'Normal',
      dental_findings: student.dental_findings || '',
      visual_acuity_left: student.visual_acuity_left || '20/20',
      visual_acuity_right: student.visual_acuity_right || '20/20',
      remarks: student.remarks || ''
    });
    setShowDocModal(true);
  };

  const calculateBMI = (height, weight) => {
    if (!height || !weight) return { bmi: '', category: '' };
    const hMeters = height / 100;
    const bmi = (weight / (hMeters * hMeters)).toFixed(1);
    let category = 'Normal';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi >= 25 && bmi < 29.9) category = 'Overweight';
    else if (bmi >= 30) category = 'Obese';
    return { bmi, category };
  };

  const handleDocSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.student_id,
          screening_type: activeSchedule.screening_type,
          formData: docData
        })
      });
      if (res.ok) {
        setShowDocModal(false);
        openViewModal(activeSchedule);
      }
    } catch (err) {
      console.error('Error submitting document:', err);
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      title: '', screening_type: 'BMI', scheduled_date: '', start_time: '', end_time: '',
      target_program_id: '', target_year_level: '', target_section: ''
    });
    setSelectedStudentIds([]);
  };

  // Tab Filtering Logic based on Scheduled Date
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredSchedules = schedules.filter(s => {
    const sDate = s.scheduled_date ? s.scheduled_date.split('T')[0] : '';
    if (activeTab === 'upcoming') return sDate > todayStr;
    if (activeTab === 'ongoing') return sDate === todayStr;
    if (activeTab === 'past') return sDate < todayStr;
    return true;
  });

  return (
    <div className="sti-health-container">
      {/* Header */}
      <header className="sti-header">
        <div className="sti-title-group">
          <h1>Health Screening Management</h1>
          <p>Schedule, manage, and document student health assessments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
          <Plus size={18} /> Schedule Screening
        </button>
      </header>

      {/* Tabs */}
      <div className="sti-tabs">
        <button 
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={16} /> Upcoming Screenings
        </button>
        <button 
          className={`tab-btn ${activeTab === 'ongoing' ? 'active' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          <Clock size={16} /> Ongoing Screenings
        </button>
        <button 
          className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <CheckCircle size={16} /> Past Screenings
        </button>
      </div>

      {/* Card Grid */}
      <div className="sti-card-grid">
        {filteredSchedules.length === 0 ? (
          <div className="no-records">
            <p>No screening schedules found for this status.</p>
          </div>
        ) : (
          filteredSchedules.map(sch => (
            <div key={sch.screening_schedule_id} className="sti-card">
              <div className="card-badge">
                {sch.screening_type === 'BMI' && <Activity size={14} />}
                {sch.screening_type === 'Dental' && <Smile size={14} />}
                {sch.screening_type === 'Vision' && <Eye size={14} />}
                {sch.screening_type}
              </div>
              <h3 className="card-title">{sch.title}</h3>
              <p className="card-info"><Calendar size={14} /> {sch.scheduled_date ? sch.scheduled_date.split('T')[0] : ''}</p>
              <p className="card-info"><Clock size={14} /> {sch.start_time} - {sch.end_time}</p>
              <p className="card-info"><Users size={14} /> {sch.total_students || 0} Students Assigned</p>
              
              <div className="card-actions">
                {activeTab === 'upcoming' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSchedule(sch); setShowEditModal(true); }}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleCancelSchedule(sch.screening_schedule_id)}>
                      <Trash2 size={14} /> Cancel
                    </button>
                  </>
                )}

                {(activeTab === 'ongoing' || activeTab === 'past') && (
                  <button className="btn btn-primary btn-sm" onClick={() => openViewModal(sch)}>
                    <FileText size={14} /> View & Document
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: Schedule Screening Details (Step 1) */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Schedule Health Screening (Step 1 of 2)</h2>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleNextToStudents} className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  required 
                  value={scheduleForm.title} 
                  onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} 
                  placeholder="e.g. Annual Dental Checkup" 
                />
              </div>

              <div className="form-group">
                <label>Screening Type</label>
                <select value={scheduleForm.screening_type} onChange={e => setScheduleForm({...scheduleForm, screening_type: e.target.value})}>
                  <option value="BMI">BMI Monitoring</option>
                  <option value="Dental">Dental Assessment</option>
                  <option value="Vision">Vision Screening</option>
                </select>
              </div>

              <div className="form-group">
                <label>Scheduled Date</label>
                <input 
                  type="date" 
                  required 
                  value={scheduleForm.scheduled_date} 
                  onChange={e => setScheduleForm({...scheduleForm, scheduled_date: e.target.value})} 
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Start Time</label>
                  <input 
                    type="time" 
                    required 
                    value={scheduleForm.start_time} 
                    onChange={e => setScheduleForm({...scheduleForm, start_time: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input 
                    type="time" 
                    required 
                    value={scheduleForm.end_time} 
                    onChange={e => setScheduleForm({...scheduleForm, end_time: e.target.value})} 
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  Next: Select Target Students <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Select Target Students (Step 2) */}
      {showStudentSelectModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>Select Target Students (Step 2 of 2)</h2>
              <button className="close-btn" onClick={() => setShowStudentSelectModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSchedule} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Academic Program</label>
                  <select value={scheduleForm.target_program_id} onChange={e => setScheduleForm({...scheduleForm, target_program_id: e.target.value})}>
                    <option value="">All Programs</option>
                    {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year Level</label>
                  <select value={scheduleForm.target_year_level} onChange={e => setScheduleForm({...scheduleForm, target_year_level: e.target.value})}>
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <input type="text" placeholder="e.g. BSIT-101" value={scheduleForm.target_section} onChange={e => setScheduleForm({...scheduleForm, target_section: e.target.value})} />
                </div>
              </div>

              <div className="student-select-list">
                <label>Matching Students ({filterStudents.length}) — {selectedStudentIds.length} Total Selected</label>
                <div className="student-table-wrapper">
                  <table className="sti-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={areAllFilteredSelected} 
                            onChange={handleSelectAllFiltered}
                            disabled={filterStudents.length === 0}
                            title="Select/Deselect all matching students"
                          />
                        </th>
                        <th>Student Name</th>
                        <th>Program</th>
                        <th>Year & Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filterStudents.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#6c757d' }}>
                            No students match the selected Program, Year Level, or Section filter.
                          </td>
                        </tr>
                      ) : (
                        filterStudents.map(st => (
                          <tr key={st.student_id}>
                            <td>
                              <input 
                                type="checkbox" 
                                checked={selectedStudentIds.includes(st.student_id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, st.student_id]);
                                  else setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.student_id));
                                }}
                              />
                            </td>
                            <td>{st.first_name} {st.last_name}</td>
                            <td>{st.program_name || st.program_id}</td>
                            <td>Yr {st.year_level} - {st.section}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleBackToSchedule}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="btn btn-primary">Save & Notify Students</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Upcoming Schedule */}
      {showEditModal && editingSchedule && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Update Screening Schedule</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="modal-body">
              <div className="form-group">
                <label>Scheduled Date</label>
                <input type="date" required value={editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : ''} onChange={e => setEditingSchedule({...editingSchedule, scheduled_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" required value={editingSchedule.start_time} onChange={e => setEditingSchedule({...editingSchedule, start_time: e.target.value})} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" required value={editingSchedule.end_time} onChange={e => setEditingSchedule({...editingSchedule, end_time: e.target.value})} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update & Notify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: View & Document Ongoing/Past Screening */}
      {showViewModal && activeSchedule && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>{activeSchedule.title} - Participant List ({activeSchedule.screening_type})</h2>
              <button className="close-btn" onClick={() => setShowViewModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <table className="sti-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Program</th>
                    <th>Year/Section</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleStudents.map(st => {
                    const isDocumented = st.bmi_log_id || st.dental_record_id || st.vision_record_id;
                    return (
                      <tr key={st.student_id}>
                        <td>{st.first_name} {st.last_name}</td>
                        <td>{st.program_name}</td>
                        <td>Yr {st.year_level} - {st.section}</td>
                        <td>
                          <span className={`badge ${isDocumented ? 'badge-success' : 'badge-warning'}`}>
                            {isDocumented ? 'Documented' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => openDocumentModal(st)}>
                            <FileText size={14} /> Document Result
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Dynamic Screening Entry Form */}
      {showDocModal && selectedStudent && activeSchedule && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Document Screening: {selectedStudent.first_name} {selectedStudent.last_name}</h2>
              <button className="close-btn" onClick={() => setShowDocModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleDocSubmit} className="modal-body">
              {/* BMI FORM */}
              {activeSchedule.screening_type === 'BMI' && (
                <>
                  <div className="form-group">
                    <label>Height (cm)</label>
                    <input 
                      type="number" step="0.1" required value={docData.height_cm} 
                      onChange={e => {
                        const h = e.target.value;
                        const { bmi, category } = calculateBMI(h, docData.weight_kg);
                        setDocData({...docData, height_cm: h, bmi_value: bmi, bmi_category: category});
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input 
                      type="number" step="0.1" required value={docData.weight_kg} 
                      onChange={e => {
                        const w = e.target.value;
                        const { bmi, category } = calculateBMI(docData.height_cm, w);
                        setDocData({...docData, weight_kg: w, bmi_value: bmi, bmi_category: category});
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Calculated BMI</label>
                    <input type="text" readOnly value={docData.bmi_value} placeholder="Auto-calculated" />
                  </div>
                  <div className="form-group">
                    <label>BMI Category</label>
                    <input type="text" readOnly value={docData.bmi_category} placeholder="Auto-categorized" />
                  </div>
                </>
              )}

              {/* DENTAL FORM */}
              {activeSchedule.screening_type === 'Dental' && (
                <>
                  <div className="form-group">
                    <label>Dental Findings</label>
                    <textarea required value={docData.dental_findings} onChange={e => setDocData({...docData, dental_findings: e.target.value})} rows={3} placeholder="Describe oral health observations..." />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Recommendations / Treatment advice..." />
                  </div>
                </>
              )}

              {/* VISION FORM */}
              {activeSchedule.screening_type === 'Vision' && (
                <>
                  <div className="form-group">
                    <label>Visual Acuity (Left Eye)</label>
                    <input type="text" required value={docData.visual_acuity_left} onChange={e => setDocData({...docData, visual_acuity_left: e.target.value})} placeholder="e.g. 20/20" />
                  </div>
                  <div className="form-group">
                    <label>Visual Acuity (Right Eye)</label>
                    <input type="text" required value={docData.visual_acuity_right} onChange={e => setDocData({...docData, visual_acuity_right: e.target.value})} placeholder="e.g. 20/20" />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Prescription / Doctor referral notes..." />
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}