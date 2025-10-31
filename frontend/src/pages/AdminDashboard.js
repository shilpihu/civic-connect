import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertCircle, ArrowLeft, Users, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Access denied');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [reportsRes, analyticsRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/reports`),
        axios.get(`${API_URL}/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setReports(reportsRes.data);
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (reportId, technicianId) => {
    try {
      await axios.put(
        `${API_URL}/reports/${reportId}/assign`,
        { assigned_to_id: technicianId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Report assigned successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to assign report');
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || report.status === statusFilter;
    const matchesCategory = !categoryFilter || categoryFilter === 'all' || report.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const technicians = users.filter((u) => u.role === 'technician');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const categoryData = analytics?.category_counts?.map((item) => ({
    name: item._id,
    value: item.count,
  })) || [];

  const statusData = analytics?.status_counts?.map((item) => ({
    name: item._id,
    count: item.count,
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              data-testid="back-btn"
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-7 h-7 text-emerald-600" />
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* KPIs */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<AlertCircle className="w-8 h-8 text-blue-600" />}
            title="Total Reports"
            value={analytics?.total_reports || 0}
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<Clock className="w-8 h-8 text-yellow-600" />}
            title="Open Reports"
            value={analytics?.open_reports || 0}
            bgColor="bg-yellow-50"
          />
          <StatCard
            icon={<CheckCircle className="w-8 h-8 text-green-600" />}
            title="Resolved"
            value={analytics?.resolved_reports || 0}
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<Users className="w-8 h-8 text-purple-600" />}
            title="Technicians"
            value={technicians.length}
            bgColor="bg-purple-50"
          />
        </div>

        {/* Analytics Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white shadow-lg border-0">
            <CardHeader>
              <CardTitle>Reports by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0">
            <CardHeader>
              <CardTitle>Reports by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Reports Map */}
        <Card className="bg-white shadow-lg border-0 mb-8">
          <CardHeader>
            <CardTitle>Reports Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 rounded-lg overflow-hidden">
              {reports.length > 0 && (
                <MapContainer
                  center={[reports[0].location.lat, reports[0].location.lng]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {reports.map((report) => (
                    <Marker
                      key={report.id}
                      position={[report.location.lat, report.location.lng]}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold">{report.title}</h3>
                          <p className="text-sm text-gray-600">{report.category}</p>
                          <p className="text-xs text-gray-500">{report.status}</p>
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => navigate(`/report/${report.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card className="bg-white shadow-lg border-0">
          <CardHeader>
            <CardTitle>All Reports</CardTitle>
            <div className="flex flex-wrap gap-4 mt-4">
              <Input
                data-testid="search-input"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter" className="w-48">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="category-filter" className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="electricity">Electricity</SelectItem>
                  <SelectItem value="garbage">Garbage</SelectItem>
                  <SelectItem value="streetlight">Streetlight</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Title</th>
                    <th className="text-left p-3 font-semibold">Category</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Priority</th>
                    <th className="text-left p-3 font-semibold">Assigned To</th>
                    <th className="text-left p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <button
                          onClick={() => navigate(`/report/${report.id}`)}
                          className="text-left hover:text-emerald-600 font-medium"
                        >
                          {report.title}
                        </button>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">{report.category}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            report.status === 'registered'
                              ? 'bg-blue-100 text-blue-700'
                              : report.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : report.status === 'resolved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {report.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            report.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : report.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {report.priority}
                        </span>
                      </td>
                      <td className="p-3">
                        {report.assigned_to_name ? (
                          <span className="text-sm">{report.assigned_to_name}</span>
                        ) : (
                          <Select
                            onValueChange={(value) => handleAssign(report.id, value)}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {technicians.map((tech) => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/report/${report.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ icon, title, value, bgColor }) {
  return (
    <Card className={`${bgColor} border-0 shadow-md`}>
      <CardContent className="p-6 flex items-center gap-4">
        <div>{icon}</div>
        <div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-600">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}
