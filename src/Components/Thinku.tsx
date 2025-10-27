import React from 'react';
import { useNavigate } from 'react-router-dom';

type ThinkuProps = {
  onNext: () => void;
};

const Thinku: React.FC<ThinkuProps> = ({ }) => {
  const navigate = useNavigate();
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        margin: 0,
        backgroundColor: '#f4f4f4',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
          maxWidth: '500px',
        }}
      >
        <h1
          style={{
            color: '#333',
            marginBottom: '20px',
          }}
        >
          Thank You for Your Submission!
        </h1>

        <p
          style={{
            color: '#666',
            fontSize: '1.1em',
            marginBottom: '20px',
          }}
        >
          We appreciate you taking the time to connect with us.
        </p>

        <p
          style={{
            color: '#666',
            fontSize: '1.1em',
            marginBottom: '30px',
          }}
        >
          Your message has been received and we’ll get back to you shortly.
        </p>

        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1em',
            transition: 'background-color 0.3s ease',
          }}
          onMouseOver={(e) =>
            ((e.target as HTMLButtonElement).style.backgroundColor = '#0056b3')
          }
          onMouseOut={(e) =>
            ((e.target as HTMLButtonElement).style.backgroundColor = '#007bff')
          }
        >
          Restart
        </button>
      </div>
    </div>
  );
};

export default Thinku;
