import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { AlertCircle, Upload, X, MapPin, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition, setAddress }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      reverseGeocode(e.latlng.lat, e.latlng.lng, setAddress);
    },
  });

  return position ? <Marker position={position} /> : null;
}

const reverseGeocode = async (lat, lng, setAddress) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    setAddress(response.data.display_name);
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  }
};

export default function CreateReport() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('medium');
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          reverseGeocode(latitude, longitude, setAddress);
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Default to a city center
          setPosition([40.7128, -74.0060]); // New York
          setAddress('Location not detected');
        }
      );
    } else {
      setPosition([40.7128, -74.0060]);
      setAddress('Geolocation not supported');
    }
  }, []);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setImages([...images, ...files]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!position) {
      toast.error('Please select a location on the map');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('priority', priority);
      formData.append('lat', position[0]);
      formData.append('lng', position[1]);
      formData.append('address', address);

      images.forEach((image) => {
        formData.append('images', image);
      });

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post(`${API_URL}/reports`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...headers,
        },
      });

      toast.success('Report created successfully!');
      navigate(`/report/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create report:', error);
      toast.error(error.response?.data?.detail || 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  if (!position) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            data-testid="back-btn"
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-7 h-7 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Report an Issue</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Form Section */}
            <div className="space-y-6">
              <Card className="bg-white shadow-lg border-0">
                <CardHeader>
                  <CardTitle>Report Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      data-testid="title-input"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief description of the issue"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="water">Water Leak</SelectItem>
                        <SelectItem value="road">Road/Pothole</SelectItem>
                        <SelectItem value="electricity">Electricity</SelectItem>
                        <SelectItem value="garbage">Garbage</SelectItem>
                        <SelectItem value="streetlight">Streetlight</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger data-testid="priority-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      data-testid="description-input"
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide more details about the issue..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Photos (up to 5)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {images.map((image, index) => (
                        <div key={index} className="image-preview">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${index + 1}`}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="remove-image"
                            onClick={() => removeImage(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {images.length < 5 && (
                        <button
                          data-testid="upload-image-btn"
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                        >
                          <Upload className="w-6 h-6 text-gray-400" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Map Section */}
            <div className="space-y-6">
              <Card className="bg-white shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-80 rounded-lg overflow-hidden">
                    <MapContainer
                      center={position}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <LocationMarker
                        position={position}
                        setPosition={setPosition}
                        setAddress={setAddress}
                      />
                    </MapContainer>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      data-testid="address-input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Click on map to set location"
                    />
                    <p className="text-xs text-gray-500">
                      Click on the map to set the exact location of the issue
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                data-testid="submit-report-btn"
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
