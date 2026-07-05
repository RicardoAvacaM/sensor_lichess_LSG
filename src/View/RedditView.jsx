import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/RedditView.css';

function RedditView() {
  const [message, setMessage] = useState('');
  const [hasPlayer, setHasPlayer] = useState(false);
  const [todayPoints, setTodayPoints] = useState(0); // Agregado
  const [yesterdayPoints, setYesterdayPoints] = useState(0); // Agregado

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get('http://localhost:8080/users/all');

        if (response.status === 201) {
          const user = response.data[0];

          if (user.id_reddit != null) {
            console.log(user.id_reddit);
            setHasPlayer(true);
          } else {
            setHasPlayer(false);
            setMessage('No users found.');
          }
        } else {
          setMessage('The user could not be obtained.');
        }
      } catch (error) {
        setMessage('Error communicating with the server to obtain a user.');
      }
    };

    const fetchSensorPoints = async () => {
      try {
        const response = await axios.post('http://localhost:8080/users/allPoints', {
          tipe_sensor: "Reddit",
        });
    
        if (response.status === 200 && response.data.data.length > 0) {
          const sensorPoints = response.data.data;
          const today = parseFloat(sensorPoints[0] || 0);
          const yesterday = parseFloat(sensorPoints[1] || 0);
    
          setTodayPoints(today);
          setYesterdayPoints(yesterday);
        } else {
          setMessage('Sensor points could not be obtained.');
        }
      } catch (error) {
        setMessage('Error communicating with the server to obtain sensor points.');
      }
    };
    

    fetchSensorPoints();
    fetchUser();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      console.log('Login Reddit');
      const clientId = 'L4WM_WKSe6i5hRk55iTe0A';
      const state = 'abc123xyz789';
      const redirectUri = 'http://localhost:8080/users/callback';
      const scope = 'identity';
      const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${redirectUri}&scope=${scope}`;

      window.open(authUrl, '_blank');

      let attempts = 0;
      const intervalId = setInterval(async () => {
        attempts++;
        try {
          const response = await fetch('http://localhost:8080/users/check-reddit-user');
          if (response.ok) {
            const data = await response.json();
            if (data.userCreated) {
              setMessage('User created successfully.');
              setHasPlayer(true);
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Error in the request: ', error.message);
        }
        if (attempts >= 12) {
          clearInterval(intervalId);
          setMessage('Timeout. User not created. Please try again.');
        }
      }, 5000);
    } catch (error) {
      setMessage('Server error: ' + error.response?.data?.error || error.message);
    }
  };

  return (
    <div className="login-container">
      {hasPlayer ? (
        <div className="points-container">
          <h1>Your Points</h1>
          <div className="points-box1">Today's points: <span>{todayPoints}</span></div>
          <div className="points-box1">Yesterday's points: <span>{yesterdayPoints}</span></div>
          <div className="points-box2"><span>{message}</span></div>
        </div>
      ) : (
        <div className="login-form">
          <h1>Connect to Reddit</h1>
          <p>{message}</p>
          <button type="submit" onClick={handleLogin}>Login with Reddit</button>
        </div>
      )}
    </div>
  );
}

export default RedditView;
