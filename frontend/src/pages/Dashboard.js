import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { MapPin, AlertCircle, LogOut, Plus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReports();
  }, [statusFilter, categoryFilter]);

  const fetchReports = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;

      const response = await axios.get(`${API_URL}/reports`, { params });
      setReports(response.data);
    } catch (error) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const myReports = user ? filteredReports.filter(r => r.created_by_id === user.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-7 h-7 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">CivicConnect</h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{user.name}</span>
                <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                  {user.role}
                </span>
              </div>
            )}
            {user?.role === 'admin' && (
              <Button
                data-testid="admin-dashboard-btn"
                onClick={() => navigate('/admin')}
                variant="outline"
                size="sm"
              >
                Admin Dashboard
              </Button>
            )}
            <Button
              data-testid="create-report-btn"
              onClick={() => navigate('/create-report')}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Report
            </Button>
            {user && (
              <Button
                data-testid="logout-btn"
                onClick={logout}
                variant="outline"
                size="sm"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {user ? 'My Reports' : 'All Reports'}
          </h2>
          <p className="text-gray-600">
            {user ? 'Track the status of your submitted reports' : 'View all civic issue reports'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Input
            data-testid="search-input"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs bg-white"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="status-filter" className="w-48 bg-white">
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
            <SelectTrigger data-testid="category-filter" className="w-48 bg-white">
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

        {/* Reports Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(user ? myReports : filteredReports).map((report) => (
              <ReportCard key={report.id} report={report} onClick={() => navigate(`/report/${report.id}`)} />
            ))}
          </div>
        )}

        {!loading && (user ? myReports : filteredReports).length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No reports found</h3>
            <p className="text-gray-500 mb-6">Start by creating your first report</p>
            <Button
              data-testid="create-first-report-btn"
              onClick={() => navigate('/create-report')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Create Report
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function ReportCard({ report, onClick }) {
  const statusColors = {
    registered: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
  };

  const priorityColors = {
    low: 'border-l-green-500',
    medium: 'border-l-yellow-500',
    high: 'border-l-red-500',
  };

  return (
    <Card
      data-testid={`report-card-${report.id}`}
      onClick={onClick}
      className={`cursor-pointer hover:shadow-lg transition-shadow bg-white border-l-4 ${priorityColors[report.priority]}`}
    >
      <div className="p-6">
        {report.images.length > 0 && (
          <div className="mb-4 rounded-lg overflow-hidden h-48">
            <img
              src={process.env.REACT_APP_BACKEND_URL + report.images[0]}
              alt="Report"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{report.title}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[report.status]}`}>
            {report.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{report.description}</p>
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <MapPin className="w-4 h-4 mr-1" />
          <span className="line-clamp-1">{report.location.address}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded">{report.category}</span>
          <span>{new Date(report.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </Card>
  );
}
