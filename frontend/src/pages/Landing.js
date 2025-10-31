import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-8 h-8 text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">CivicConnect</h1>
        </div>
        <div className="flex gap-3">
          {user ? (
            <Button
              data-testid="dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button
                data-testid="login-btn"
                variant="outline"
                onClick={() => navigate('/login')}
              >
                Login
              </Button>
              <Button
                data-testid="signup-btn"
                onClick={() => navigate('/signup')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
          Report Civic Issues,
          <br />
          <span className="text-emerald-600">Build Better Communities</span>
        </h2>
        <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Help your city solve problems faster. Report streetlight outages, potholes, water leaks, and more with just a few taps.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            data-testid="report-issue-btn"
            size="lg"
            onClick={() => navigate('/create-report')}
            className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Report an Issue
          </Button>
          <Button
            data-testid="view-reports-btn"
            size="lg"
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="text-lg px-8 py-6 rounded-full border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
          >
            View Reports
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <FeatureCard
            icon={<MapPin className="w-10 h-10 text-emerald-600" />}
            title="GPS Location"
            description="Automatically detect and pin exact locations of civic issues on the map."
          />
          <FeatureCard
            icon={<Users className="w-10 h-10 text-emerald-600" />}
            title="Track Progress"
            description="Follow your reports from submission to resolution with real-time updates."
          />
          <FeatureCard
            icon={<TrendingUp className="w-10 h-10 text-emerald-600" />}
            title="Analytics Dashboard"
            description="Municipal teams can view hotspots and performance metrics at a glance."
          />
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl shadow-lg p-12 max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-emerald-600 mb-2">Fast</div>
              <div className="text-gray-600">Average Response Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-emerald-600 mb-2">Easy</div>
              <div className="text-gray-600">Simple Reporting Process</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-emerald-600 mb-2">Transparent</div>
              <div className="text-gray-600">Real-time Status Updates</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-600">
        <p>&copy; 2025 CivicConnect. Making cities better, one report at a time.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
