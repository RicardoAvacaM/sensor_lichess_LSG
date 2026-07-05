import React, { useState } from 'react';
import Login from './View/Login';
import Dashboard from './View/Dashboard';

function App() {
  const [view, setView] = useState('login');

  return (
    <div>
      {view === 'login' && <Login setView={setView} />}
      {view === 'dashboard' && <Dashboard />}
    </div>
  );
}

export default App;
