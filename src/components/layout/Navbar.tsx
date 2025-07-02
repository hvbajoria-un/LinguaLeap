import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, History } from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const isInterviewRoom = location.pathname === '/interview-room';

  if (isInterviewRoom) return null;

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <img
                src="https://d8it4huxumps7.cloudfront.net/uploads/images/unstop/branding-guidelines/logos/white/Unstop-Logo-White-Medium.png"
                alt="Unstop Logo"
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* To show the app title in the center of the navbar */}
          <div className="flex-1 flex justify-center font-bold text-white" style={{ fontSize: '20px' }}>
            Unstop AI DUO
          </div>
          
          <div className="flex space-x-4">
            <Link
              to="/"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                location.pathname === '/'
                  ? 'text-white bg-gray-800'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Link>
            <Link
              to="/interview-history"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                location.pathname === '/interview-history'
                  ? 'text-white bg-gray-800'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}