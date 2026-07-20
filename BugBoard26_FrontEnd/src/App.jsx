import { useState } from 'react';
import LoginPage from './LoginPage';
import MainPage from './MainPage';

function App() {
  const [token, setToken] = useState(localStorage.getItem('bugboard_token'));

  if (!token) {
    return <LoginPage onLoginSuccess={(data) => setToken(data.token)} />;
  }

  return <MainPage onLogout={() => setToken(null)} />;
}

export default App;