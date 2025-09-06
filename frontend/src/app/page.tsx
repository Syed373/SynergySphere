import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Users, CheckSquare, MessageCircle, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'SynergySphere - Advanced Team Collaboration Platform',
  description: 'Transform how your team works together. SynergySphere combines project management, task tracking, and seamless communication in one intelligent platform.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">SynergySphere</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Where Teams
            <span className="text-blue-600"> Collaborate</span>
            <br />
            Without Friction
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            SynergySphere transforms how your team works together. Combine project management, 
            task tracking, and seamless communication in one intelligent platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg px-8 py-3 inline-flex items-center">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link href="#features" className="btn-secondary text-lg px-8 py-3">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything Your Team Needs
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Designed to solve the real problems teams face every day
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Smart Task Management</h3>
              <p className="text-gray-600">
                Organize, assign, and track tasks with intelligent priority suggestions and deadline alerts.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-green-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Team Collaboration</h3>
              <p className="text-gray-600">
                Bring your team together with project-specific discussions and real-time updates.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Seamless Communication</h3>
              <p className="text-gray-600">
                Keep all project conversations organized and accessible to the right people.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Progress Insights</h3>
              <p className="text-gray-600">
                Get clear visibility into project progress and potential bottlenecks before they happen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Team's Workflow?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of teams already working smarter with SynergySphere.
          </p>
          <Link href="/register" className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg transition-colors inline-flex items-center">
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">SynergySphere</h3>
            <p className="text-gray-400 mb-8">
              Empowering teams to collaborate without friction
            </p>
            <div className="text-sm text-gray-500">
              © 2024 SynergySphere. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}