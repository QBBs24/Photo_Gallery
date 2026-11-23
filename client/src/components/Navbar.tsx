import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Image, Upload, User as UserIcon, LogOut, LogIn, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-neutral-950/80 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Image className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
            Photo<span className="text-pink-500">Gallery</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/')
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            Gallery
          </Link>
          <Link
            to="/upload"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/upload')
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Upload className="w-4 h-4 text-pink-500" />
            Upload
          </Link>
        </nav>

        {/* Right Section / Auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <UserIcon className="w-3.5 h-3.5 text-neutral-400" />
                <span>{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 space-y-2 bg-neutral-950/95 border-b border-neutral-800 animate-in slide-in-from-top-2 duration-200">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-base font-medium ${
              isActive('/') ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            Public Gallery
          </Link>
          <Link
            to="/upload"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-base font-medium ${
              isActive('/upload') ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            Upload Images
          </Link>
          <div className="pt-2 border-t border-neutral-800">
            {user ? (
              <div className="space-y-2">
                <div className="px-3 py-2 text-sm text-neutral-400">
                  Signed in as <span className="font-semibold text-white">{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/30"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 px-3 rounded-lg text-sm font-medium bg-neutral-900 text-neutral-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 px-3 rounded-lg text-sm font-semibold bg-blue-600 text-white"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
