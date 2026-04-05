"use client";

import { useState, useEffect } from "react";
import { FaTasks, FaPlus, FaCalendarAlt, FaCheck, FaClock, FaUser, FaFilter, FaSearch, FaTrash, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { listSalesTasks, createSalesTask, toggleSalesTaskStatus, deleteSalesTask, getPipelines, listDeals } from "@/lib/api/sales";
import { fetchContacts } from "@/lib/api/contacts";
import { toast } from "react-hot-toast";

export default function SalesTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, my-tasks, overdue
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "Medium",
    relatedContact: "",
    relatedDeal: ""
  });
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);

  useEffect(() => {
    fetchTasks();
    fetchSupportData();
  }, [filter]);

  const fetchSupportData = async () => {
    try {
      const contactsRes = await fetchContacts(1, 100);
      setContacts(contactsRes.data || []);
      
      const pipelinesData = await getPipelines();
      const pipelinesList = pipelinesData?.pipelines || [];
      setPipelines(pipelinesList);
      
      if (pipelinesList.length > 0) {
        const dealsRes = await listDeals({ pipelineId: pipelinesList[0]._id });
        setDeals(dealsRes.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch support data:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter === "overdue") params.overdue = "true";
      // Additional filters like 'assignee' can be added here if auth user is known
      
      const response = await listSalesTasks(params);
      setTasks(response.data || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (taskId) => {
    try {
      await toggleSalesTaskStatus(taskId);
      toast.success("Task status updated");
      fetchTasks();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteSalesTask(taskId);
      toast.success("Task deleted");
      fetchTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      // Clean up optional fields that might be empty strings
      const payload = { ...newTask };
      if (!payload.relatedContact) delete payload.relatedContact;
      if (!payload.relatedDeal) delete payload.relatedDeal;
      
      await createSalesTask(payload);
      toast.success("Task created");
      setIsModalOpen(false);
      setNewTask({ title: "", description: "", dueDate: "", priority: "Medium", relatedContact: "", relatedDeal: "" });
      fetchTasks();
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(error.response?.data?.message || "Failed to create task");
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'High': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'Medium': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'Low': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
    return colors[priority] || 'bg-muted text-muted-foreground';
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-primary to-primary/80 shadow-premium">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
                <FaTasks className="text-white text-3xl" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Sales Tasks</h1>
                <p className="text-white/80 text-sm mt-1 font-medium font-inter">Efficiency is the heartbeat of sales success</p>
              </div>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-primary rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-95"
            >
              <FaPlus />
              <span>Create Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total Tasks', value: tasks.length, color: 'text-primary' },
            { label: 'Pending', value: tasks.filter(t => t.status === 'Pending').length, color: 'text-muted-foreground' },
            { label: 'In Progress', value: tasks.filter(t => t.status === 'In Progress').length, color: 'text-blue-500' },
            { label: 'Completed', value: tasks.filter(t => t.status === 'Completed').length, color: 'text-emerald-500' }
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-3xl shadow-sm border border-border p-6 hover:shadow-lg transition-all group">
              <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2 font-inter">{stat.label}</p>
              <p className={`text-4xl font-extrabold font-outfit ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8 bg-card/50 backdrop-blur-sm p-4 rounded-3xl border border-border">
          <div className="flex items-center space-x-2 p-1 bg-muted/30 rounded-2xl border border-border/50">
            {['all', 'my-tasks', 'overdue'].map((f) => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  filter === f 
                    ? 'bg-white shadow-md text-primary dark:bg-muted' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-96 group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Search tasks by title or desc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Tasks View */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground font-medium animate-pulse">Syncing your sales velocity...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-32 bg-card rounded-[3rem] border-2 border-dashed border-border/50 flex flex-col items-center">
            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-6">
              <FaTasks className="text-muted-foreground/30 text-3xl" />
            </div>
            <h3 className="text-2xl font-bold text-foreground font-outfit">All Clear!</h3>
            <p className="text-muted-foreground max-w-sm mt-2 font-inter leading-relaxed">No tasks currently demand your attention. Take a breath or start a new deal!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTasks.map((task) => (
              <div 
                key={task._id} 
                className={`bg-card rounded-[2rem] border-2 group transition-all p-6 hover:shadow-2xl flex items-start gap-4 ${
                  task.status === 'Completed' ? 'opacity-70 border-emerald-500/20 grayscale-[0.3]' : 'border-border hover:border-primary/30'
                }`}
              >
                <button 
                  onClick={() => handleToggleStatus(task._id)}
                  className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    task.status === 'Completed' 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                      : 'bg-muted hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all border-2 border-border'
                  }`}
                >
                  <FaCheck className={task.status === 'Completed' ? "w-4 h-4" : "w-3 h-3 opacity-0 group-hover:opacity-100"} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${getPriorityColor(task.priority)}`}>
                      {task.priority || 'Medium'}
                    </span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FaCalendarAlt className="w-3 h-3" />
                      <span className="text-[11px] font-medium">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                      </span>
                    </div>
                  </div>

                  <h3 className={`text-lg font-bold font-outfit tracking-tight truncate ${task.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </h3>
                  
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 font-inter font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-6 pt-5 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-xs">
                        {task.assignee?.name?.charAt(0) || 'A'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assignee</span>
                        <span className="text-xs font-bold text-foreground leading-tight">{task.assignee?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDeleteTask(task._id)}
                        className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        title="Delete Task"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card w-full max-w-lg rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-border overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 bg-gradient-to-br from-primary to-primary/80">
              <div className="flex justify-between items-center text-white mb-2">
                <h2 className="text-3xl font-extrabold font-outfit">New Sales Task</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                  <FaPlus className="rotate-45" />
                </button>
              </div>
              <p className="text-white/70 font-medium text-sm">Strategic follow-ups start here</p>
            </div>

            <form onSubmit={handleCreateTask} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Task Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g., Follow up with potential whale lead"
                  className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-inter font-medium text-foreground placeholder:text-muted-foreground/50"
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Priority</label>
                  <select 
                    className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-inter font-bold text-foreground"
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Due Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-inter font-bold text-foreground"
                    value={newTask.dueDate}
                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Related Contact</label>
                  <select 
                    className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-inter font-bold text-foreground"
                    value={newTask.relatedContact}
                    onChange={e => setNewTask({...newTask, relatedContact: e.target.value})}
                  >
                    <option value="">None</option>
                    {contacts.map((c, idx) => (
                      <option key={c.id || idx} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Related Deal</label>
                  <select 
                    className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-inter font-bold text-foreground"
                    value={newTask.relatedDeal}
                    onChange={e => setNewTask({...newTask, relatedDeal: e.target.value})}
                  >
                    <option value="">None</option>
                    {deals.map((d, idx) => (
                      <option key={d._id || idx} value={d._id}>{d.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Description (Optional)</label>
                <textarea 
                  rows="2"
                  className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-inter font-medium text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Any context or mission details..."
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                ></textarea>
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-primary text-white rounded-2xl font-extrabold shadow-premium hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-[0.98] font-outfit text-xl tracking-tight"
              >
                Launch Task
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .shadow-premium { box-shadow: 0 10px 40px -10px rgba(var(--primary), 0.3); }
      `}</style>
    </div>
  );
}
