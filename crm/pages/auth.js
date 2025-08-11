import React from 'react';

const AuthPage = () => {
  return (
    <div>
      <h1>Google Authentication</h1>
      <a href='/api/googleAuth?action=auth'>Start OAuth Flow</a>
    </div>
  );
};

export default AuthPage;
