import React, { useState, useEffect, createContext, useContext, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import "@/App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Components
const Header = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(250);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch fake online count
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await api.get('/online');
        if (res.data.success) setOnlineCount(res.data.online);
      } catch (e) {
        setOnlineCount(200 + Math.floor(Math.random() * 200));
      }
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="header" data-testid="header">
      <div className="header-content">
        <Link to="/" className="logo" data-testid="logo-link">
          <img src="/logo.png" alt="EASY MONEY" className="logo-img" />
          <span className="logo-text">EASY MONEY</span>
        </Link>
        
        <div className="online-counter" data-testid="online-counter">
          <span className="online-dot"></span>
          <span className="online-count">{onlineCount} онлайн</span>
        </div>
        
        <nav className={`nav ${menuOpen ? 'open' : ''}`} data-testid="nav-menu">
          <Link to="/" className="nav-link" data-testid="nav-home">Главная</Link>
          <Link to="/mines" className="nav-link" data-testid="nav-mines">Mines</Link>
          <Link to="/dice" className="nav-link" data-testid="nav-dice">Dice</Link>
          <Link to="/wheel" className="nav-link" data-testid="nav-wheel">Wheel</Link>
          {user && <Link to="/bonus" className="nav-link" data-testid="nav-bonus">Бонусы</Link>}
          {user && <Link to="/ref" className="nav-link" data-testid="nav-ref">Партнёрка</Link>}
          <a href="https://t.me/easymoneycaspro" target="_blank" rel="noopener noreferrer" className="nav-link tg-link" data-testid="nav-telegram">
            <i className="fa-brands fa-telegram"></i> Telegram
          </a>
        </nav>

        <div className="header-right">
          {user ? (
            <>
              <div className="balance-box" data-testid="balance-box">
                <span className="balance-amount">{user.balance?.toFixed(2)} ₽</span>
                <button className="btn-deposit" onClick={() => navigate('/wallet')} data-testid="deposit-btn">
                  <i className="fa-solid fa-wallet"></i>
                </button>
              </div>
              <div className="user-menu" data-testid="user-menu">
                <img src={user.img || "/logo.png"} alt="" className="user-avatar" />
                <div className="user-dropdown">
                  <span className="user-name">{user.name}</span>
                  <Link to="/wallet" className="dropdown-item">Кошелёк</Link>
                  <Link to="/ref" className="dropdown-item">Партнёрка</Link>
                  <button onClick={logout} className="dropdown-item logout" data-testid="logout-btn">Выход</button>
                </div>
              </div>
            </>
          ) : (
            <button className="btn-auth" onClick={() => navigate('/login')} data-testid="login-btn">
              <i className="fa-brands fa-telegram"></i> Войти
            </button>
          )}
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} data-testid="menu-toggle">
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>
      </div>
      
      {/* Fullscreen Navigation Menu */}
      {menuOpen && (
        <div className="fullscreen-menu" data-testid="fullscreen-menu">
          <div className="fullscreen-menu-header">
            <span className="menu-title">Навигация</span>
            <button className="close-menu" onClick={() => setMenuOpen(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="fullscreen-menu-content">
            <div className="menu-section">
              <div className="menu-section-title">Игры</div>
              <Link to="/mines" className="menu-item" data-testid="menu-mines">
                <i className="fa-solid fa-bomb"></i>
                <span>Mines</span>
              </Link>
              <Link to="/dice" className="menu-item" data-testid="menu-dice">
                <i className="fa-solid fa-dice"></i>
                <span>Dice</span>
              </Link>
              <Link to="/wheel" className="menu-item" data-testid="menu-wheel">
                <i className="fa-solid fa-dharmachakra"></i>
                <span>Wheel</span>
              </Link>
              <Link to="/crash" className="menu-item" data-testid="menu-crash">
                <i className="fa-solid fa-chart-line"></i>
                <span>Crash</span>
              </Link>
              <Link to="/bubbles" className="menu-item" data-testid="menu-bubbles">
                <i className="fa-solid fa-circle"></i>
                <span>Bubbles</span>
              </Link>
              <Link to="/x100" className="menu-item" data-testid="menu-x100">
                <i className="fa-solid fa-bolt"></i>
                <span>X100</span>
              </Link>
            </div>
            
            <div className="menu-section">
              <div className="menu-section-title">Аккаунт</div>
              {user ? (
                <>
                  <Link to="/wallet" className="menu-item" data-testid="menu-wallet">
                    <i className="fa-solid fa-wallet"></i>
                    <span>Кошелёк</span>
                  </Link>
                  <Link to="/bonus" className="menu-item" data-testid="menu-bonus">
                    <i className="fa-solid fa-gift"></i>
                    <span>Бонусы</span>
                  </Link>
                  <Link to="/ref" className="menu-item" data-testid="menu-ref">
                    <i className="fa-solid fa-users"></i>
                    <span>Партнёрка</span>
                  </Link>
                  <Link to="/support" className="menu-item" data-testid="menu-support">
                    <i className="fa-solid fa-headset"></i>
                    <span>Поддержка</span>
                  </Link>
                </>
              ) : (
                <Link to="/login" className="menu-item" data-testid="menu-login">
                  <i className="fa-brands fa-telegram"></i>
                  <span>Войти через Telegram</span>
                </Link>
              )}
            </div>
            
            <div className="menu-section">
              <div className="menu-section-title">Информация</div>
              <a href="https://t.me/easymoneycaspro" target="_blank" rel="noopener noreferrer" className="menu-item">
                <i className="fa-brands fa-telegram"></i>
                <span>Telegram канал</span>
              </a>
              <Link to="/" className="menu-item" data-testid="menu-home">
                <i className="fa-solid fa-house"></i>
                <span>Главная</span>
              </Link>
            </div>
            
            {user && (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="menu-logout-btn" data-testid="menu-logout">
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Выйти из аккаунта</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

const Footer = () => (
  <footer className="footer" data-testid="footer">
    <div className="footer-content">
      <div className="footer-logo">
        <img src="/logo.png" alt="EASY MONEY" />
        <span>EASY MONEY</span>
      </div>
      <div className="footer-links">
        <a href="https://t.me/easymoneycaspro" target="_blank" rel="noopener noreferrer">
          <i className="fa-brands fa-telegram"></i> Telegram
        </a>
        <Link to="/policy"><i className="fa-solid fa-shield-halved"></i> Политика конфиденциальности</Link>
        <Link to="/terms"><i className="fa-solid fa-file-contract"></i> Пользовательское соглашение</Link>
      </div>
      <div className="footer-copy">© 2025 EASY MONEY. Все права защищены.</div>
    </div>
  </footer>
);

const GameHistory = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/history/recent?limit=15');
        if (res.data.success) setHistory(res.data.history);
      } catch (e) {}
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const gameIcons = { 
    mines: 'fa-bomb', 
    dice: 'fa-dice', 
    bubbles: 'fa-circle', 
    wheel: 'fa-dharmachakra',
    x100: 'fa-circle-notch',
    crash: 'fa-rocket',
    keno: 'fa-table-cells'
  };
  const gameNames = { 
    mines: 'Mines', 
    dice: 'Dice', 
    bubbles: 'Bubbles', 
    wheel: 'Wheel',
    x100: 'X100',
    crash: 'Crash',
    keno: 'Keno'
  };

  return (
    <div className="game-history" data-testid="game-history">
      <h3><i className="fa-solid fa-clock-rotate-left"></i> История игр</h3>
      <div className="history-list">
        {history.map((h, i) => (
          <div key={i} className={`history-item ${h.status}`} data-testid={`history-item-${i}`}>
            <div className="history-row-top">
              <div className="history-game">
                <i className={`fa-solid ${gameIcons[h.game] || 'fa-gamepad'}`}></i>
                <span>{gameNames[h.game] || h.game}</span>
              </div>
              <div className="history-bet">{h.bet?.toFixed(2)} ₽</div>
            </div>
            <div className="history-row-bottom">
              <div className="history-coeff">x{h.coefficient?.toFixed ? h.coefficient.toFixed(2) : h.coefficient}</div>
              <div className={`history-result ${h.status}`}>
                {h.status === 'win' ? `+${h.win?.toFixed(2)}` : '0.00'} ₽
              </div>
            </div>
            <div className="history-user-desktop">{h.name?.split(' ')[0]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Pages
const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const games = [
    { id: 'mines', name: 'Mines', icon: 'fa-bomb', desc: 'Найди все алмазы и избегай бомб!', color: '#10b981' },
    { id: 'dice', name: 'Dice', icon: 'fa-dice', desc: 'Угадай число и выиграй!', color: '#3b82f6' },
    { id: 'bubbles', name: 'Bubbles', icon: 'fa-circle', desc: 'Поймай свой множитель!', color: '#8b5cf6' },
    { id: 'wheel', name: 'Wheel', icon: 'fa-dharmachakra', desc: 'Крути колесо фортуны!', color: '#f59e0b' },
    { id: 'crash', name: 'Crash', icon: 'fa-rocket', desc: 'Успей забрать до краша!', color: '#ef4444' },
    { id: 'x100', name: 'X100', icon: 'fa-circle-notch', desc: 'Поймай x100 множитель!', color: '#ec4899' }
  ];

  return (
    <div className="page home-page" data-testid="home-page">
      <div className="hero">
        <img src="/logo.png" alt="EASY MONEY" className="hero-logo" />
        <h1>EASY MONEY</h1>
        <p>Играй и выигрывай! Лучшие игры с честным RTP</p>
        {!user && (
          <button className="btn-hero" onClick={() => navigate('/login')} data-testid="hero-login-btn">
            <i className="fa-brands fa-telegram"></i> Начать играть
          </button>
        )}
      </div>

      <div className="games-grid" data-testid="games-grid">
        {games.map(g => (
          <div key={g.id} className="game-card" onClick={() => navigate(`/${g.id}`)} data-testid={`game-card-${g.id}`}>
            <div className="game-icon" style={{ background: g.color }}>
              <i className={`fa-solid ${g.icon}`}></i>
            </div>
            <h3>{g.name}</h3>
            <p>{g.desc}</p>
            <button className="btn-play">Играть</button>
          </div>
        ))}
      </div>

      <GameHistory />
    </div>
  );
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const refCode = new URLSearchParams(location.search).get('ref');

  useEffect(() => {
    // Define global callback for Telegram Widget
    window.onTelegramAuth = async (tgUser) => {
      setLoading(true);
      try {
        const res = await api.post('/auth/telegram', { 
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name || '',
          username: tgUser.username || '',
          photo_url: tgUser.photo_url || '',
          auth_date: tgUser.auth_date,
          hash: tgUser.hash,
          ref_code: refCode 
        });
        if (res.data.success) {
          login(res.data.token, res.data.user);
          toast.success('Добро пожаловать!');
          navigate('/');
        }
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Ошибка авторизации');
      }
      setLoading(false);
    };

    // Load Telegram Widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'Irjeukdnr_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.innerHTML = '';
      container.appendChild(script);
    }

    return () => {
      delete window.onTelegramAuth;
    };
  }, [refCode, login, navigate]);

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const username = `player_${Math.random().toString(36).substr(2, 6)}`;
      const res = await api.post(`/auth/demo?username=${username}${refCode ? `&ref_code=${refCode}` : ''}`);
      if (res.data.success) {
        login(res.data.token, res.data.user);
        toast.success('Добро пожаловать!');
        navigate('/');
      }
    } catch (e) {
      toast.error('Ошибка входа');
    }
    setLoading(false);
  };

  return (
    <div className="page login-page" data-testid="login-page">
      <div className="login-card">
        <img src="/logo.png" alt="EASY MONEY" className="login-logo" />
        <h2>Вход в EASY MONEY</h2>
        <p>Авторизуйтесь через Telegram для начала игры</p>
        
        <div id="telegram-login-container" className="telegram-widget" data-testid="telegram-widget">
          {/* Telegram Widget will be inserted here */}
        </div>

        <div className="login-divider"><span>или</span></div>

        <button className="btn-demo" onClick={handleDemoLogin} disabled={loading} data-testid="demo-login-btn">
          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-play"></i>}
          Демо режим (с балансом 1000₽)
        </button>

        <p className="login-note">
          <i className="fa-solid fa-shield"></i> Безопасная авторизация через Telegram
        </p>
      </div>
    </div>
  );
};

const MinesGame = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [bombs, setBombs] = useState(5);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cells, setCells] = useState(Array(25).fill({ status: 'hidden', type: null }));

  useEffect(() => {
    if (user) checkActiveGame();
  }, [user]);

  const checkActiveGame = async () => {
    try {
      const res = await api.get('/games/mines/current');
      if (res.data.success && res.data.active) {
        setGame(res.data);
        const newCells = Array(25).fill({ status: 'hidden', type: null });
        res.data.clicked?.forEach(c => {
          newCells[c - 1] = { status: 'opened', type: 'safe' };
        });
        setCells(newCells);
      }
    } catch (e) {}
  };

  const startGame = async () => {
    if (!user) return navigate('/login');
    if (user.balance < bet) return toast.error('Недостаточно средств');
    
    setLoading(true);
    try {
      const res = await api.post('/games/mines/play', { bet, bombs });
      if (res.data.success) {
        setGame({ active: true, bet, bombs, win: 0, clicked: [] });
        setCells(Array(25).fill({ status: 'hidden', type: null }));
        updateBalance(res.data.balance);
        toast.success('Игра началась!');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const pressCell = async (index) => {
    if (!game?.active || cells[index].status !== 'hidden') return;
    
    setLoading(true);
    try {
      const res = await api.post('/games/mines/press', { cell: index + 1 });
      if (res.data.success) {
        const newCells = [...cells];
        
        if (res.data.status === 'lose') {
          newCells[index] = { status: 'opened', type: 'bomb' };
          res.data.mines?.forEach(m => {
            if (m !== index + 1) newCells[m - 1] = { status: 'revealed', type: 'bomb' };
          });
          res.data.win_positions?.forEach(p => {
            newCells[p - 1] = { status: 'revealed', type: 'safe' };
          });
          setGame(null);
          toast.error('Бум! Вы проиграли');
        } else if (res.data.status === 'finish') {
          newCells[index] = { status: 'opened', type: 'safe' };
          res.data.mines?.forEach(m => {
            newCells[m - 1] = { status: 'revealed', type: 'bomb' };
          });
          setGame(null);
          updateBalance(res.data.balance);
          toast.success(`Победа! +${res.data.win?.toFixed(2)}₽`);
        } else {
          newCells[index] = { status: 'opened', type: 'safe' };
          setGame(prev => ({ ...prev, win: res.data.win, clicked: res.data.clicked }));
        }
        setCells(newCells);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const takeWin = async () => {
    if (!game?.active || game.win <= 0) return;
    
    setLoading(true);
    try {
      const res = await api.post('/games/mines/take');
      if (res.data.success) {
        const newCells = [...cells];
        res.data.mines?.forEach(m => {
          newCells[m - 1] = { status: 'revealed', type: 'bomb' };
        });
        res.data.win_positions?.forEach(p => {
          if (newCells[p - 1].status === 'hidden') newCells[p - 1] = { status: 'revealed', type: 'safe' };
        });
        setCells(newCells);
        setGame(null);
        updateBalance(res.data.balance);
        toast.success(`Вы забрали ${res.data.win?.toFixed(2)}₽!`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  return (
    <div className="page game-page mines-page" data-testid="mines-page">
      <div className="game-container">
        <div className="game-board mines-board" data-testid="mines-board">
          {cells.map((cell, i) => (
            <button
              key={i}
              className={`mines-cell ${cell.status} ${cell.type || ''}`}
              onClick={() => pressCell(i)}
              disabled={!game?.active || cell.status !== 'hidden' || loading}
              data-testid={`mines-cell-${i}`}
            >
              {cell.status !== 'hidden' && (
                cell.type === 'bomb' ? <i className="fa-solid fa-bomb"></i> : <i className="fa-solid fa-gem"></i>
              )}
            </button>
          ))}
        </div>

        <div className="game-controls" data-testid="mines-controls">
          <h2><i className="fa-solid fa-bomb"></i> Mines</h2>
          
          {!game?.active ? (
            <>
              <div className="control-group">
                <label>Ставка</label>
                <div className="bet-input">
                  <button onClick={() => setBet(Math.max(1, bet / 2))}>½</button>
                  <input type="number" value={bet} onChange={e => setBet(Math.max(1, +e.target.value))} data-testid="mines-bet-input" />
                  <button onClick={() => setBet(Math.min(user?.balance || 1000, bet * 2))}>×2</button>
                </div>
              </div>

              <div className="control-group">
                <label>Бомб: {bombs}</label>
                <input type="range" min="2" max="24" value={bombs} onChange={e => setBombs(+e.target.value)} data-testid="mines-bombs-slider" />
              </div>

              <button className="btn-start" onClick={startGame} disabled={loading} data-testid="mines-start-btn">
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Начать игру'}
              </button>
            </>
          ) : (
            <>
              <div className="game-info">
                <div className="info-item">
                  <span>Ставка</span>
                  <strong>{game.bet?.toFixed(2)} ₽</strong>
                </div>
                <div className="info-item">
                  <span>Бомб</span>
                  <strong>{game.bombs}</strong>
                </div>
                <div className="info-item highlight">
                  <span>Выигрыш</span>
                  <strong>{game.win?.toFixed(2)} ₽</strong>
                </div>
              </div>

              <button className="btn-take" onClick={takeWin} disabled={loading || game.win <= 0} data-testid="mines-take-btn">
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : `Забрать ${game.win?.toFixed(2)} ₽`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DiceGame = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [chance, setChance] = useState(50);
  const [direction, setDirection] = useState('down');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const coefficient = (100 / chance).toFixed(2);
  const threshold = direction === 'down' ? Math.floor((chance / 100) * 100) : Math.floor(100 - (chance / 100) * 100);

  const play = async () => {
    if (!user) return navigate('/login');
    if (user.balance < bet) return toast.error('Недостаточно средств');
    
    setLoading(true);
    setResult(null);
    
    try {
      const res = await api.post('/games/dice/play', { bet, chance, direction });
      if (res.data.success) {
        setResult(res.data);
        updateBalance(res.data.balance);
        if (res.data.status === 'win') {
          toast.success(`🎲 Победа! +${res.data.win?.toFixed(2)}₽`);
        } else {
          toast.error('🎲 Не повезло!');
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  return (
    <div className="page game-page dice-page" data-testid="dice-page">
      <div className="game-container">
        <div className="game-board dice-board" data-testid="dice-board">
          <div className="dice-display">
            <div className="dice-bar">
              <div className={`dice-zone ${direction === 'down' ? 'active' : ''}`} style={{ width: `${chance}%` }}>
                {direction === 'down' && <span>WIN</span>}
              </div>
              <div className={`dice-zone ${direction === 'up' ? 'active' : ''}`} style={{ width: `${100 - chance}%` }}>
                {direction === 'up' && <span>WIN</span>}
              </div>
              {result && (
                <div className={`dice-marker ${result.status}`} style={{ left: `${result.result}%` }}>
                  {result.result}
                </div>
              )}
            </div>
            <div className="dice-labels">
              <span>1</span>
              <span>{threshold}</span>
              <span>100</span>
            </div>
          </div>
          
          {result && (
            <div className={`dice-result ${result.status}`} data-testid="dice-result">
              <div className="result-number">{result.result}</div>
              <div className="result-text">{result.status === 'win' ? `+${result.win?.toFixed(2)} ₽` : 'Проигрыш'}</div>
            </div>
          )}
        </div>

        <div className="game-controls" data-testid="dice-controls">
          <h2><i className="fa-solid fa-dice"></i> Dice</h2>
          
          <div className="control-group">
            <label>Ставка</label>
            <div className="bet-input">
              <button onClick={() => setBet(Math.max(1, bet / 2))}>½</button>
              <input type="number" value={bet} onChange={e => setBet(Math.max(1, +e.target.value))} data-testid="dice-bet-input" />
              <button onClick={() => setBet(Math.min(user?.balance || 1000, bet * 2))}>×2</button>
            </div>
          </div>

          <div className="control-group">
            <label>Шанс: {chance}% (x{coefficient})</label>
            <input type="range" min="1" max="95" value={chance} onChange={e => setChance(+e.target.value)} data-testid="dice-chance-slider" />
          </div>

          <div className="control-group direction-btns">
            <button className={direction === 'down' ? 'active' : ''} onClick={() => setDirection('down')} data-testid="dice-down-btn">
              <i className="fa-solid fa-arrow-down"></i> Меньше {threshold}
            </button>
            <button className={direction === 'up' ? 'active' : ''} onClick={() => setDirection('up')} data-testid="dice-up-btn">
              <i className="fa-solid fa-arrow-up"></i> Больше {100 - threshold}
            </button>
          </div>

          <button className="btn-start" onClick={play} disabled={loading} data-testid="dice-play-btn">
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Крутить'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BubblesGame = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [target, setTarget] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [animating, setAnimating] = useState(false);
  const [bubbleSize, setBubbleSize] = useState(50);

  const play = async () => {
    if (!user) return navigate('/login');
    if (user.balance < bet) return toast.error('Недостаточно средств');
    
    setLoading(true);
    setAnimating(true);
    setResult(null);
    setCurrentMult(1.0);
    setBubbleSize(50);
    
    try {
      const res = await api.post('/games/bubbles/play', { bet, target });
      
      if (res.data.success) {
        const finalMult = res.data.result;
        let mult = 1.0;
        
        const animate = () => {
          mult += 0.03 * (1 + mult * 0.02);
          const newMult = parseFloat(Math.min(mult, finalMult).toFixed(2));
          setCurrentMult(newMult);
          setBubbleSize(50 + newMult * 25);
          
          if (mult >= finalMult) {
            setAnimating(false);
            setResult(res.data);
            updateBalance(res.data.balance);
            
            if (res.data.status === 'win') {
              toast.success(`🎉 Лопнул на x${target}! +${res.data.win?.toFixed(2)}₽`);
            } else {
              toast.error(`💥 Пузырь лопнул на x${newMult}!`);
            }
            setLoading(false);
          } else {
            setTimeout(animate, 40);
          }
        };
        animate();
      }
    } catch (e) {
      setAnimating(false);
      toast.error(e.response?.data?.detail || 'Ошибка');
      setLoading(false);
    }
  };

  return (
    <div className="page game-page bubbles-page" data-testid="bubbles-page">
      <div className="game-container">
        <div className="game-board bubbles-board" data-testid="bubbles-board">
          <div className="bubbles-display">
            {/* Animated bubble */}
            <div 
              className={`bubble ${animating ? 'inflating' : ''} ${result?.status === 'lose' ? 'popped' : ''}`}
              style={{ 
                width: `${bubbleSize}%`,
                height: `${bubbleSize}%`,
                background: result?.status === 'lose' 
                  ? 'radial-gradient(circle at 30% 30%, #ef4444, #991b1b)'
                  : result?.status === 'win'
                  ? 'radial-gradient(circle at 30% 30%, #10b981, #047857)'
                  : 'radial-gradient(circle at 30% 30%, #60a5fa, #2563eb, #1d4ed8)',
                boxShadow: `0 0 ${bubbleSize/2}px rgba(96, 165, 250, 0.4), inset 0 0 30px rgba(255,255,255,0.2)`
              }}
            >
              <div className="bubble-reflection"></div>
              <div className="bubble-mult">x{currentMult.toFixed(2)}</div>
            </div>
            
            {/* Target line */}
            <div className="target-line" style={{ bottom: `${Math.min(target * 10, 90)}%` }}>
              <span>Цель: x{target}</span>
            </div>
          </div>
        </div>
        
        <div className="game-controls" data-testid="bubbles-controls">
          <h2><i className="fa-solid fa-circle"></i> Bubbles</h2>
          
          <div className="control-group">
            <label>Цель: x{target.toFixed(2)}</label>
            <input 
              type="range" 
              min="1.1" 
              max="100" 
              step="0.1" 
              value={target} 
              onChange={e => setTarget(+e.target.value)} 
              disabled={loading}
            />
          </div>
          
          <div className="quick-targets">
            {[1.5, 2, 3, 5, 10].map(t => (
              <button 
                key={t} 
                onClick={() => setTarget(t)} 
                className={target === t ? 'active' : ''} 
                disabled={loading}
              >
                x{t}
              </button>
            ))}
          </div>
          
          <div className="control-group">
            <label>Ставка</label>
            <div className="bet-input">
              <button onClick={() => setBet(Math.max(1, bet / 2))} disabled={loading}>½</button>
              <input type="number" value={bet} onChange={e => setBet(Math.max(1, +e.target.value))} disabled={loading} data-testid="bubbles-bet-input" />
              <button onClick={() => setBet(Math.min(user?.balance || 1000, bet * 2))} disabled={loading}>×2</button>
            </div>
          </div>
          
          <div className="potential-win">
            Потенциальный выигрыш: <strong>{(bet * target).toFixed(2)} ₽</strong>
          </div>
          
          <button className="btn-start" onClick={play} disabled={loading} data-testid="bubbles-play-btn">
            {loading ? (
              animating ? <><i className="fa-solid fa-circle fa-beat-fade"></i> Надувается...</> : <i className="fa-solid fa-spinner fa-spin"></i>
            ) : 'Надуть пузырь'}
          </button>
        </div>
      </div>
    </div>
  );
};

const WheelGame = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const wheelRef = React.useRef(null);

  const coefficients = {
    1: [
      { color: 'lose', coef: 0, label: 'x0', fill: '#273451' },
      { color: 'blue', coef: 1.2, label: 'x1.2', fill: '#5480f2' },
      { color: 'red', coef: 1.5, label: 'x1.5', fill: '#f34102' }
    ],
    2: [
      { color: 'lose', coef: 0, label: 'x0', fill: '#273451' },
      { color: 'blue', coef: 1.2, label: 'x1.2', fill: '#5480f2' },
      { color: 'red', coef: 1.5, label: 'x1.5', fill: '#f34102' },
      { color: 'green', coef: 3.0, label: 'x3', fill: '#91dc00' },
      { color: 'pink', coef: 5.0, label: 'x5', fill: '#ed44cc' }
    ],
    3: [
      { color: 'lose', coef: 0, label: 'x0', fill: '#24304a' },
      { color: 'pink', coef: 49.5, label: 'x49.5', fill: '#5983b4' }
    ]
  };

  // Wheel segments for each level
  const wheelSegments = {
    1: ['lose', 'lose', 'blue', 'lose', 'blue', 'red', 'blue', 'lose', 'blue', 'blue', 'lose', 'blue', 'red', 'blue', 'blue', 'lose', 'blue', 'red', 'blue', 'blue', 'lose', 'blue', 'red', 'blue', 'blue', 'lose', 'blue', 'red', 'blue', 'blue', 'lose', 'blue', 'blue', 'lose', 'blue', 'blue', 'lose', 'blue', 'blue', 'lose', 'blue', 'blue', 'red', 'blue', 'blue', 'lose', 'blue', 'blue', 'lose', 'blue', 'blue', 'lose'],
    2: ['lose', 'lose', 'lose', 'blue', 'lose', 'blue', 'red', 'lose', 'blue', 'lose', 'blue', 'lose', 'pink', 'lose', 'blue', 'lose', 'green', 'blue', 'lose', 'blue', 'red', 'lose', 'blue', 'lose', 'blue', 'green', 'lose', 'blue', 'lose', 'blue', 'red', 'lose', 'blue', 'lose', 'pink', 'lose', 'blue', 'lose', 'blue', 'green', 'lose', 'blue', 'red', 'lose', 'blue', 'lose', 'blue', 'lose', 'green', 'lose', 'red', 'lose'],
    3: ['lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'pink', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'lose', 'pink']
  };

  const getColorFill = (color) => {
    const map = {
      lose: '#273451',
      blue: '#5480f2',
      red: '#f34102',
      green: '#91dc00',
      pink: '#ed44cc'
    };
    return map[color] || '#273451';
  };

  const play = async () => {
    if (!user) return navigate('/login');
    if (user.balance < bet) return toast.error('Недостаточно средств');
    
    setLoading(true);
    setSpinning(true);
    setResult(null);
    
    try {
      const res = await api.post('/games/wheel/play', { bet, level });
      
      if (res.data.success) {
        // Calculate rotation based on result
        const segments = wheelSegments[level];
        const segmentAngle = 360 / segments.length;
        
        // Find index of result color
        let targetIndex = segments.findIndex(s => s === res.data.color);
        if (targetIndex === -1) targetIndex = 0;
        
        // Calculate final rotation (5 full spins + target segment)
        const baseRotation = rotation + (360 * 5);
        const targetRotation = baseRotation + (segments.length - targetIndex) * segmentAngle + segmentAngle / 2;
        
        setRotation(targetRotation);
        
        // Wait for animation
        setTimeout(() => {
          setSpinning(false);
          setResult(res.data);
          updateBalance(res.data.balance);
          
          if (res.data.win > 0) {
            toast.success(`Победа! +${res.data.win.toFixed(2)}₽ (x${res.data.coef})`);
          } else {
            toast.error('Не повезло! Попробуйте ещё');
          }
          setLoading(false);
        }, 4500);
      }
    } catch (e) {
      setSpinning(false);
      toast.error(e.response?.data?.detail || 'Ошибка');
      setLoading(false);
    }
  };

  const segments = wheelSegments[level];
  const segmentAngle = 360 / segments.length;

  return (
    <div className="page game-page wheel-page" data-testid="wheel-page">
      <div className="game-container">
        <div className="game-board wheel-board" data-testid="wheel-board">
          <div className="wheel-container">
            <div className="wheel-circle">
              {/* SVG Wheel */}
              <svg 
                ref={wheelRef}
                viewBox="0 0 200 200" 
                className="wheel-svg"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
                }}
              >
                {segments.map((color, i) => {
                  const startAngle = i * segmentAngle;
                  const endAngle = (i + 1) * segmentAngle;
                  const startRad = (startAngle - 90) * Math.PI / 180;
                  const endRad = (endAngle - 90) * Math.PI / 180;
                  const x1 = 100 + 95 * Math.cos(startRad);
                  const y1 = 100 + 95 * Math.sin(startRad);
                  const x2 = 100 + 95 * Math.cos(endRad);
                  const y2 = 100 + 95 * Math.sin(endRad);
                  const largeArc = segmentAngle > 180 ? 1 : 0;
                  
                  return (
                    <path
                      key={i}
                      d={`M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={getColorFill(color)}
                      stroke="#1a1a2e"
                      strokeWidth="0.5"
                    />
                  );
                })}
                <circle cx="100" cy="100" r="30" fill="#1a1a2e" stroke="#fbbf24" strokeWidth="3"/>
              </svg>
              
              {/* Pointer at top */}
              <div className="wheel-pointer"></div>
              
              {/* Center display */}
              <div className="wheel-center">
                {result ? (
                  <div className={`wheel-result ${result.win > 0 ? 'win' : 'lose'}`}>
                    <div className="wheel-result-win">{result.win?.toFixed(2)} ₽</div>
                    <div className="wheel-result-coef">x{result.coef}</div>
                  </div>
                ) : (
                  <div className="wheel-logo">
                    <span style={{fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24'}}>SPIN</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="game-controls" data-testid="wheel-controls">
          <h2><i className="fa-solid fa-dharmachakra"></i> Wheel</h2>
          
          <div className="control-group">
            <label>Уровень сложности</label>
            <div className="level-buttons">
              <button 
                className={`level-btn ${level === 1 ? 'active' : ''}`}
                onClick={() => !loading && setLevel(1)}
                disabled={loading}
                data-testid="wheel-level-1"
              >
                <span>Легкий</span>
                <small>x1.2 - x1.5</small>
              </button>
              <button 
                className={`level-btn ${level === 2 ? 'active' : ''}`}
                onClick={() => !loading && setLevel(2)}
                disabled={loading}
                data-testid="wheel-level-2"
              >
                <span>Средний</span>
                <small>x1.2 - x5</small>
              </button>
              <button 
                className={`level-btn ${level === 3 ? 'active' : ''}`}
                onClick={() => !loading && setLevel(3)}
                disabled={loading}
                data-testid="wheel-level-3"
              >
                <span>Сложный</span>
                <small>x49.5</small>
              </button>
            </div>
          </div>
          
          <div className="control-group">
            <label>Ставка</label>
            <div className="bet-input">
              <button onClick={() => setBet(Math.max(1, bet / 2))} disabled={loading}>½</button>
              <input type="number" value={bet} onChange={e => setBet(Math.max(1, +e.target.value))} disabled={loading} data-testid="wheel-bet-input" />
              <button onClick={() => setBet(Math.min(user?.balance || 1000, bet * 2))} disabled={loading}>×2</button>
            </div>
          </div>

          <div className="wheel-info">
            <div className="wheel-info-title">Множители:</div>
            <div className="wheel-info-list">
              {coefficients[level].filter(c => c.coef > 0).map((c, i) => (
                <span key={i} className="wheel-coef-badge" style={{ backgroundColor: c.fill }}>{c.label}</span>
              ))}
            </div>
          </div>

          <button className="btn-start wheel-spin-btn" onClick={play} disabled={loading} data-testid="wheel-play-btn">
            {loading ? (
              spinning ? <><i className="fa-solid fa-dharmachakra fa-spin"></i> Крутится...</> : <i className="fa-solid fa-spinner fa-spin"></i>
            ) : <><i className="fa-solid fa-play"></i> Крутить колесо</>}
          </button>
        </div>
      </div>
    </div>
  );
};

const Wallet = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('deposit');
  const [amount, setAmount] = useState(100);
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState({ payments: [], withdraws: [] });

  const isDemo = user?.is_demo;

  useEffect(() => {
    if (!isDemo) fetchHistory();
  }, [isDemo]);

  const fetchHistory = async () => {
    try {
      const [payments, withdraws] = await Promise.all([
        api.get('/payment/history'),
        api.get('/withdraw/history')
      ]);
      setHistory({
        payments: payments.data.payments || [],
        withdraws: withdraws.data.withdraws || []
      });
    } catch (e) {}
  };

  const createPayment = async () => {
    if (isDemo) {
      toast.error('Пополнение недоступно в демо-режиме. Авторизуйтесь через Telegram.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/payment/create', { amount, system: 'freekassa' });
      if (res.data.success) {
        toast.info('Платёжная система в режиме тестирования');
        // Mock complete payment
        await api.post(`/payment/mock/complete/${res.data.payment_id}`);
        const me = await api.get('/auth/me');
        if (me.data.success) updateBalance(me.data.user.balance);
        toast.success(`Баланс пополнен на ${amount}₽`);
        fetchHistory();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const createWithdraw = async () => {
    if (isDemo) {
      toast.error('Вывод недоступен в демо-режиме. Авторизуйтесь через Telegram.');
      return;
    }
    if (!wallet) return toast.error('Введите кошелёк');
    setLoading(true);
    try {
      const res = await api.post('/withdraw/create', { amount, wallet, system: 'qiwi' });
      if (res.data.success) {
        const me = await api.get('/auth/me');
        if (me.data.success) updateBalance(me.data.user.balance);
        toast.success('Заявка на вывод создана');
        fetchHistory();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  return (
    <div className="page wallet-page" data-testid="wallet-page">
      <div className="wallet-card">
        <h2><i className="fa-solid fa-wallet"></i> Кошелёк</h2>
        
        {isDemo && (
          <div className="demo-warning" data-testid="demo-warning">
            <i className="fa-solid fa-exclamation-triangle"></i>
            <div>
              <strong>Демо-режим</strong>
              <p>Пополнение и вывод недоступны. Для полного доступа авторизуйтесь через Telegram.</p>
              <button className="btn-telegram" onClick={() => navigate('/login')}>
                <i className="fa-brands fa-telegram"></i> Войти через Telegram
              </button>
            </div>
          </div>
        )}
        
        <div className="wallet-balance">
          <span>Баланс {isDemo && '(демо)'}</span>
          <strong>{user?.balance?.toFixed(2)} ₽</strong>
        </div>

        <div className="wallet-tabs">
          <button className={tab === 'deposit' ? 'active' : ''} onClick={() => setTab('deposit')} data-testid="wallet-deposit-tab">Пополнить</button>
          <button className={tab === 'withdraw' ? 'active' : ''} onClick={() => setTab('withdraw')} data-testid="wallet-withdraw-tab">Вывести</button>
        </div>

        {tab === 'deposit' ? (
          <div className="wallet-form" data-testid="deposit-form">
            <div className="form-group">
              <label>Сумма (мин. 50₽)</label>
              <input type="number" value={amount} onChange={e => setAmount(+e.target.value)} min="50" data-testid="deposit-amount" disabled={isDemo} />
            </div>
            <div className="quick-amounts">
              {[100, 500, 1000, 5000].map(a => (
                <button key={a} onClick={() => setAmount(a)} disabled={isDemo}>{a}₽</button>
              ))}
            </div>
            <button className="btn-submit" onClick={createPayment} disabled={loading || amount < 50 || isDemo} data-testid="deposit-submit">
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : isDemo ? 'Недоступно в демо' : 'Пополнить'}
            </button>
            {!isDemo && <p className="wallet-note"><i className="fa-solid fa-info-circle"></i> Платежи в тестовом режиме</p>}
          </div>
        ) : (
          <div className="wallet-form" data-testid="withdraw-form">
            <div className="form-group">
              <label>Сумма (мин. 100₽)</label>
              <input type="number" value={amount} onChange={e => setAmount(+e.target.value)} min="100" data-testid="withdraw-amount" disabled={isDemo} />
            </div>
            <div className="form-group">
              <label>Кошелёк</label>
              <input type="text" value={wallet} onChange={e => setWallet(e.target.value)} placeholder="Номер карты/кошелька" data-testid="withdraw-wallet" disabled={isDemo} />
            </div>
            {user?.wager > 0 && !isDemo && (
              <p className="wallet-warning"><i className="fa-solid fa-exclamation-triangle"></i> Отыграйте вейджер: {user.wager?.toFixed(2)}₽</p>
            )}
            <button className="btn-submit" onClick={createWithdraw} disabled={loading || amount < 100 || user?.wager > 0 || isDemo} data-testid="withdraw-submit">
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : isDemo ? 'Недоступно в демо' : 'Вывести'}
            </button>
          </div>
        )}

        {!isDemo && (
          <div className="wallet-history">
            <h3>История</h3>
          {(tab === 'deposit' ? history.payments : history.withdraws).map((item, i) => (
            <div key={i} className={`history-item ${item.status}`}>
              <span>{item.amount?.toFixed(2)}₽</span>
              <span className="status">{item.status === 'completed' ? 'Выполнен' : item.status === 'pending' ? 'Ожидание' : 'Отклонён'}</span>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Payment Success Page - redirects to home
const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate]);
  
  return (
    <div className="page payment-result-page" data-testid="payment-success-page">
      <div className="payment-result-card success">
        <div className="result-icon success">
          <i className="fa-solid fa-check-circle"></i>
        </div>
        <h2>Оплата прошла успешно!</h2>
        <p>Ваш баланс пополнен. Спасибо за пополнение!</p>
        <div className="result-redirect">
          <span>Перенаправление на главную через {countdown}...</span>
        </div>
        <button className="btn-result" onClick={() => navigate('/')}>
          <i className="fa-solid fa-house"></i> На главную
        </button>
      </div>
    </div>
  );
};

// Payment Failed Page
const PaymentFailed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const errorMessage = searchParams.get('error') || 'Произошла ошибка при обработке платежа';
  const errorCode = searchParams.get('code') || '';
  
  return (
    <div className="page payment-result-page" data-testid="payment-failed-page">
      <div className="payment-result-card failed">
        <div className="result-icon failed">
          <i className="fa-solid fa-times-circle"></i>
        </div>
        <h2>Оплата не прошла</h2>
        <p className="error-message">{errorMessage}</p>
        {errorCode && <p className="error-code">Код ошибки: {errorCode}</p>}
        
        <div className="result-info">
          <h4><i className="fa-solid fa-info-circle"></i> Возможные причины:</h4>
          <ul>
            <li>Недостаточно средств на карте/кошельке</li>
            <li>Карта заблокирована или истёк срок действия</li>
            <li>Превышен лимит операций</li>
            <li>Технические проблемы на стороне платёжной системы</li>
            <li>Операция отклонена банком</li>
          </ul>
        </div>
        
        <div className="result-actions">
          <button className="btn-result primary" onClick={() => navigate('/wallet')}>
            <i className="fa-solid fa-rotate-right"></i> Попробовать снова
          </button>
          <button className="btn-result secondary" onClick={() => navigate('/')}>
            <i className="fa-solid fa-house"></i> На главную
          </button>
        </div>
        
        <div className="result-support">
          <p>Если проблема повторяется, обратитесь в поддержку:</p>
          <a href="https://t.me/easymoneycaspro" target="_blank" rel="noopener noreferrer" className="support-link">
            <i className="fa-brands fa-telegram"></i> Написать в Telegram
          </a>
        </div>
      </div>
    </div>
  );
};

const Bonus = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [raceback, setRaceback] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyBonus, setDailyBonus] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('bonuses');

  const isDemo = user?.is_demo;

  useEffect(() => {
    fetchRaceback();
    fetchDailyBonus();
    fetchAchievements();
    fetchDailyTasks();
  }, []);

  const fetchRaceback = async () => {
    try {
      const res = await api.get('/bonus/raceback');
      if (res.data.success) setRaceback(res.data.raceback);
    } catch (e) {}
  };

  const fetchDailyTasks = async () => {
    try {
      const res = await api.get('/tasks/daily');
      if (res.data.success) setDailyTasks(res.data.tasks || []);
    } catch (e) {}
  };

  const claimDailyTask = async (taskId) => {
    if (isDemo) {
      toast.error('Задания недоступны в демо-режиме');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/tasks/daily/${taskId}/claim`);
      if (res.data.success) {
        updateBalance(res.data.balance);
        toast.success(`🎯 ${res.data.message}`);
        fetchDailyTasks();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const fetchDailyBonus = async () => {
    try {
      const res = await api.get('/bonus/daily');
      if (res.data.success) setDailyBonus(res.data);
    } catch (e) {}
  };

  const fetchAchievements = async () => {
    try {
      const res = await api.get('/achievements');
      if (res.data.success) setAchievements(res.data.achievements);
    } catch (e) {}
  };

  const claimRaceback = async () => {
    if (isDemo) {
      toast.error('Кешбэк недоступен в демо-режиме');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/bonus/raceback/claim');
      if (res.data.success) {
        updateBalance(res.data.balance);
        setRaceback(0);
        toast.success(`Получено ${res.data.claimed?.toFixed(2)}₽`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const claimDailyBonus = async () => {
    if (isDemo) {
      toast.error('Ежедневный бонус недоступен в демо-режиме');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/bonus/daily/claim');
      if (res.data.success) {
        updateBalance(res.data.balance);
        toast.success(`🎁 ${res.data.message}`);
        fetchDailyBonus();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const activatePromo = async () => {
    if (!promoCode) return;
    if (isDemo) {
      toast.error('Промокоды недоступны в демо-режиме');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/promo/activate?code=${promoCode}`);
      if (res.data.success) {
        updateBalance(res.data.balance);
        toast.success(`Промокод активирован! +${res.data.reward?.toFixed(2)}₽`);
        setPromoCode('');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Промокод недействителен');
    }
    setLoading(false);
  };

  const claimAchievement = async (id) => {
    if (isDemo) {
      toast.error('Достижения недоступны в демо-режиме');
      return;
    }
    try {
      const res = await api.post(`/achievements/${id}/claim`);
      if (res.data.success) {
        updateBalance(res.data.balance);
        toast.success(`🏆 ${res.data.achievement}! +${res.data.reward}₽`);
        fetchAchievements();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
  };

  return (
    <div className="page bonus-page" data-testid="bonus-page">
      <h2><i className="fa-solid fa-gift"></i> Бонусы и достижения</h2>

      {isDemo && (
        <div className="demo-warning" data-testid="demo-warning-bonus">
          <i className="fa-solid fa-exclamation-triangle"></i>
          <div>
            <strong>Демо-режим</strong>
            <p>Бонусы и достижения недоступны. Авторизуйтесь через Telegram для получения наград!</p>
            <button className="btn-telegram" onClick={() => navigate('/login')}>
              <i className="fa-brands fa-telegram"></i> Войти через Telegram
            </button>
          </div>
        </div>
      )}

      <div className="bonus-tabs">
        <button className={activeTab === 'bonuses' ? 'active' : ''} onClick={() => setActiveTab('bonuses')}>
          <i className="fa-solid fa-gift"></i> Бонусы
        </button>
        <button className={activeTab === 'daily' ? 'active' : ''} onClick={() => setActiveTab('daily')}>
          <i className="fa-solid fa-calendar-day"></i> Ежедневный
        </button>
        <button className={activeTab === 'achievements' ? 'active' : ''} onClick={() => setActiveTab('achievements')}>
          <i className="fa-solid fa-trophy"></i> Достижения
        </button>
      </div>

      {activeTab === 'bonuses' && (
        <div className="bonus-cards">
          <div className="bonus-card raceback" data-testid="raceback-card">
            <div className="bonus-icon"><i className="fa-solid fa-rotate-left"></i></div>
            <h3>Кешбэк 10%</h3>
            <p>Получите 10% от проигранных ставок при нулевом балансе</p>
            <div className="bonus-amount">{raceback?.toFixed(2)} ₽</div>
            <button onClick={claimRaceback} disabled={loading || raceback < 1 || user?.balance > 0 || isDemo} data-testid="claim-raceback-btn">
              {isDemo ? 'Недоступно в демо' : user?.balance > 0 ? 'Доступно при 0 балансе' : 'Забрать'}
            </button>
          </div>

          <div className="bonus-card promo" data-testid="promo-card">
            <div className="bonus-icon"><i className="fa-solid fa-ticket"></i></div>
            <h3>Промокод</h3>
            <p>Введите промокод для получения бонуса</p>
            <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Введите промокод" data-testid="promo-input" disabled={isDemo} />
            <button onClick={activatePromo} disabled={loading || !promoCode || isDemo} data-testid="activate-promo-btn">
              {isDemo ? 'Недоступно в демо' : 'Активировать'}
            </button>
          </div>

          <div className="bonus-card telegram" data-testid="telegram-card">
            <div className="bonus-icon"><i className="fa-brands fa-telegram"></i></div>
            <h3>Telegram канал</h3>
            <p>Подпишитесь на наш канал для получения эксклюзивных промокодов</p>
            <a href="https://t.me/easymoneycaspro" target="_blank" rel="noopener noreferrer" className="btn-telegram">
              Подписаться
            </a>
          </div>
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="daily-bonus-section" data-testid="daily-bonus-section">
          <div className="daily-bonus-header">
            <h3><i className="fa-solid fa-calendar-star"></i> Ежедневный бонус</h3>
            <p>Заходите каждый день и получайте бонусы! Серия: {dailyBonus?.streak || 0} дней</p>
          </div>
          
          <div className="daily-bonus-days">
            {[1,2,3,4,5,6,7].map(day => {
              const defaultRewards = {1: 10, 2: 15, 3: 25, 4: 40, 5: 60, 6: 80, 7: 150};
              const currentDay = dailyBonus?.next_day || 1;
              const isPast = day < currentDay;
              const isCurrent = day === currentDay && dailyBonus?.can_claim;
              const isLocked = day > currentDay || (day === currentDay && !dailyBonus?.can_claim);
              const reward = dailyBonus?.rewards?.[day] || defaultRewards[day];
              
              return (
                <div key={day} className={`daily-day ${isPast ? 'claimed' : ''} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}`}>
                  <div className="day-number">День {day}</div>
                  <div className="day-reward">
                    {day === 7 ? <i className="fa-solid fa-crown"></i> : <i className="fa-solid fa-coins"></i>}
                    {reward}₽
                  </div>
                  {isPast && <i className="fa-solid fa-check-circle day-check"></i>}
                  {isLocked && day !== currentDay && <i className="fa-solid fa-lock day-lock"></i>}
                </div>
              );
            })}
          </div>
          
          <button 
            className="claim-daily-btn" 
            onClick={claimDailyBonus} 
            disabled={loading || !dailyBonus?.can_claim || isDemo}
            data-testid="claim-daily-btn"
          >
            {isDemo ? (
              <>Недоступно в демо</>
            ) : dailyBonus?.can_claim ? (
              <><i className="fa-solid fa-gift"></i> Получить {dailyBonus?.next_bonus}₽</>
            ) : (
              <><i className="fa-solid fa-clock"></i> Приходите завтра</>
            )}
          </button>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="achievements-section" data-testid="achievements-section">
          <div className="achievements-grid">
            {achievements.map(a => (
              <div key={a.id} className={`achievement-card ${a.unlocked ? 'unlocked' : 'locked'}`} data-testid={`achievement-${a.id}`}>
                <div className="achievement-icon">
                  <i className={`fa-solid ${a.icon}`}></i>
                </div>
                <div className="achievement-info">
                  <h4>{a.name}</h4>
                  <p>{a.desc}</p>
                  <div className="achievement-reward">+{a.reward}₽</div>
                </div>
                {a.unlocked && (
                  <button className="claim-achievement-btn" onClick={() => claimAchievement(a.id)} disabled={isDemo}>
                    <i className="fa-solid fa-check"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Referral = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const isDemo = user?.is_demo;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/ref/stats');
      if (res.data.success) setStats(res.data);
    } catch (e) {}
  };

  const withdrawRef = async () => {
    if (isDemo) {
      toast.error('Партнёрская программа недоступна в демо-режиме');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/ref/withdraw');
      if (res.data.success) {
        updateBalance(res.data.balance);
        fetchStats();
        toast.success(`Выведено ${res.data.withdrawn?.toFixed(2)}₽`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
    setLoading(false);
  };

  const copyLink = () => {
    if (isDemo) {
      toast.error('Авторизуйтесь через Telegram для получения реферальной ссылки');
      return;
    }
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${stats?.ref_link}`);
    toast.success('Ссылка скопирована!');
  };

  // Block demo users with message
  if (isDemo) {
    return (
      <div className="page ref-page" data-testid="ref-page">
        <h2><i className="fa-solid fa-users"></i> Партнёрская программа</h2>
        
        <div className="demo-warning" data-testid="demo-warning-ref">
          <i className="fa-solid fa-lock"></i>
          <div>
            <strong>Демо-режим</strong>
            <p>Партнёрская программа недоступна в демо-режиме. Авторизуйтесь через Telegram чтобы приглашать друзей и зарабатывать!</p>
            <button className="btn-telegram" onClick={() => navigate('/login')}>
              <i className="fa-brands fa-telegram"></i> Войти через Telegram
            </button>
          </div>
        </div>
        
        <div className="ref-preview">
          <p className="ref-desc">Приглашайте друзей и получайте 50% от их депозитов!</p>
          <div className="ref-stats-preview">
            <div className="ref-stat disabled">
              <i className="fa-solid fa-user-plus"></i>
              <div className="stat-value">—</div>
              <div className="stat-label">Рефералов</div>
            </div>
            <div className="ref-stat disabled">
              <i className="fa-solid fa-coins"></i>
              <div className="stat-value">—</div>
              <div className="stat-label">Доступно</div>
            </div>
            <div className="ref-stat disabled">
              <i className="fa-solid fa-chart-line"></i>
              <div className="stat-value">—</div>
              <div className="stat-label">Всего</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page ref-page" data-testid="ref-page">
      <h2><i className="fa-solid fa-users"></i> Партнёрская программа</h2>
      <p className="ref-desc">Приглашайте друзей и получайте 50% от их депозитов!</p>

      <div className="ref-link-box" data-testid="ref-link-box">
        <label>Ваша реферальная ссылка:</label>
        <div className="ref-link">
          <input type="text" value={`${window.location.origin}/?ref=${stats?.ref_link || ''}`} readOnly />
          <button onClick={copyLink}><i className="fa-solid fa-copy"></i></button>
        </div>
      </div>

      <div className="ref-stats">
        <div className="ref-stat">
          <i className="fa-solid fa-user-plus"></i>
          <div className="stat-value">{stats?.referalov || 0}</div>
          <div className="stat-label">Рефералов</div>
        </div>
        <div className="ref-stat">
          <i className="fa-solid fa-coins"></i>
          <div className="stat-value">{stats?.income?.toFixed(2) || '0.00'} ₽</div>
          <div className="stat-label">Доступно</div>
        </div>
        <div className="ref-stat">
          <i className="fa-solid fa-chart-line"></i>
          <div className="stat-value">{stats?.income_all?.toFixed(2) || '0.00'} ₽</div>
          <div className="stat-label">Всего заработано</div>
        </div>
      </div>

      <button className="btn-withdraw-ref" onClick={withdrawRef} disabled={loading || (stats?.income || 0) < 10} data-testid="withdraw-ref-btn">
        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : `Вывести ${stats?.income?.toFixed(2) || '0.00'} ₽`}
      </button>
      <p className="ref-note">Минимум для вывода: 10₽</p>
    </div>
  );
};


// Crash Game - Online mode with history
const CrashGame = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [gamePhase, setGamePhase] = useState('waiting');
  const [betId, setBetId] = useState(null);
  const [history, setHistory] = useState([]);
  const [countdown, setCountdown] = useState(3);
  
  // Critical: prevent multiple game loops
  const gameLoopRef = useRef(null);
  const animationRef = useRef(null);
  const isGameRunningRef = useRef(false);

  // Fetch real history from DB
  const fetchHistory = async () => {
    try {
      const res = await api.get('/games/crash/history');
      if (res.data.success && res.data.history) {
        setHistory(res.data.history.slice(0, 20));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  // Load history on mount and refresh every 10 seconds
  useEffect(() => {
    fetchHistory();
    const historyInterval = setInterval(fetchHistory, 10000);
    return () => clearInterval(historyInterval);
  }, []);

  // Start game loop ONCE
  useEffect(() => {
    if (!isGameRunningRef.current) {
      isGameRunningRef.current = true;
      startGameLoop();
    }
    
    // Cleanup on unmount
    return () => {
      isGameRunningRef.current = false;
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startGameLoop = () => {
    if (!isGameRunningRef.current) return;
    
    // Phase 1: Waiting
    setGamePhase('waiting');
    setCountdown(3);
    setCrashed(false);
    setCurrentMult(1.0);
    setResult(null);
    setBetId(null);
    
    let time = 3;
    const waitInterval = setInterval(() => {
      time--;
      setCountdown(time);
      if (time <= 0) {
        clearInterval(waitInterval);
        startBettingPhase();
      }
    }, 1000);
    
    gameLoopRef.current = waitInterval;
  };

  const startBettingPhase = () => {
    if (!isGameRunningRef.current) return;
    
    setGamePhase('betting');
    setCountdown(5);
    
    let time = 5;
    const bettingInterval = setInterval(() => {
      time--;
      setCountdown(time);
      if (time <= 0) {
        clearInterval(bettingInterval);
        startFlightPhase();
      }
    }, 1000);
    
    gameLoopRef.current = bettingInterval;
  };

  const startFlightPhase = () => {
    if (!isGameRunningRef.current) return;
    
    setGamePhase('flying');
    setCrashed(false);
    
    // Generate crash point (same as server logic)
    const r = Math.random();
    let crashPoint;
    if (r < 0.99) {
      crashPoint = 0.99 / (1 - r);
    } else {
      crashPoint = Math.random() * 900 + 100;
    }
    crashPoint = Math.min(crashPoint, 1000);
    const variation = 0.8 + Math.random() * 0.4;
    const finalCrash = parseFloat((crashPoint * variation).toFixed(2));
    
    let startTime = Date.now();
    let hasProcessedResult = false;
    
    const animate = () => {
      if (!isGameRunningRef.current || crashed) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        return;
      }
      
      const elapsed = (Date.now() - startTime) / 1000;
      const mult = Math.exp(0.18 * elapsed);
      const newMult = parseFloat(mult.toFixed(2));
      
      if (newMult >= finalCrash) {
        // CRASH! Stop immediately
        setCurrentMult(finalCrash);
        setCrashed(true);
        setGamePhase('crashed');
        
        // Cancel animation immediately
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        
        // Save crash point to DB for history (no await, fire and forget)
        api.post('/games/crash/round-complete', { crash_point: finalCrash })
          .catch(e => console.error('Failed to save round:', e));
        
        // Process result if player has bet
        if (betId && !hasProcessedResult) {
          hasProcessedResult = true;
          checkResult(finalCrash);
        }
        
        // Refresh history from DB after small delay
        setTimeout(() => fetchHistory(), 500);
        
        // Wait 4 seconds then start new round
        gameLoopRef.current = setTimeout(() => {
          if (isGameRunningRef.current) {
            startGameLoop();
          }
        }, 4000);
      } else {
        setCurrentMult(newMult);
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  const placeBet = async () => {
    if (!user) return navigate('/login');
    if (user.balance < bet) return toast.error('Недостаточно средств');
    if (gamePhase !== 'betting') return toast.error('Дождитесь следующего раунда');
    
    setLoading(true);
    
    try {
      const res = await api.post('/games/crash/bet', { bet, auto_cashout: autoCashout });
      if (res.data.success) {
        setBetId(res.data.bet_id);
        updateBalance(user.balance - bet);
        toast.success('Ставка принята!');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const checkResult = async (finalMult) => {
    if (!betId) return;
    
    try {
      const res = await api.post(`/games/crash/result/${betId}`, { final_multiplier: finalMult });
      if (res.data.success) {
        updateBalance(res.data.balance);
        setResult({
          status: res.data.status,
          crashPoint: res.data.crash_point,
          win: res.data.win
        });
        
        if (res.data.status === 'win') {
          toast.success(`💰 Выигрыш: +${res.data.win.toFixed(2)}₽ (x${autoCashout})`);
        } else {
          toast.error(`💥 Краш на x${res.data.crash_point}!`);
        }
      }
    } catch (e) {
      console.error('Failed to get result:', e);
    }
  };

  return (
    <div className="page game-page crash-page" data-testid="crash-page">
      <div className="crash-container-new">
        {/* History bar - REAL from DB */}
        <div className="crash-history-bar" data-testid="crash-history">
          <div className="history-label">
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>История раундов</span>
          </div>
          <div className="history-items">
            {history.map((h, i) => (
              <div key={`${h.multiplier}-${i}`} className={`history-multiplier ${h.multiplier < 2 ? 'red' : h.multiplier >= 10 ? 'gold' : 'green'}`}>
                {h.multiplier.toFixed(2)}x
              </div>
            ))}
          </div>
        </div>
        
        {/* Main game area */}
        <div className="crash-game-area">
          <div className="crash-display-card" data-testid="crash-board">
            {gamePhase === 'waiting' ? (
              <div className="crash-waiting-state">
                <div className="waiting-icon">
                  <i className="fa-solid fa-hourglass-half"></i>
                </div>
                <h2>Ожидание</h2>
                <div className="countdown-display">{countdown}</div>
                <p>Подготовка раунда</p>
              </div>
            ) : gamePhase === 'betting' ? (
              <div className="crash-waiting-state">
                <div className="waiting-icon">
                  <i className="fa-solid fa-hand-holding-dollar"></i>
                </div>
                <h2>Приём ставок</h2>
                <div className="countdown-display">{countdown}</div>
                <p>Успей поставить!</p>
              </div>
            ) : (
              <div className="crash-active-state">
                <div className={`multiplier-big ${crashed ? 'crashed' : 'flying'}`}>
                  {currentMult.toFixed(2)}x
                </div>
                <div className={`status-indicator ${crashed ? 'crashed' : 'flying'}`}>
                  {crashed ? (
                    <>
                      <i className="fa-solid fa-bomb"></i>
                      <span>КРАШ!</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-rocket"></i>
                      <span>Летим...</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="crash-controls-card">
            <div className="control-row">
              <div className="control-group">
                <label><i className="fa-solid fa-coins"></i> Ставка</label>
                <div className="bet-input-wrapper">
                  <button onClick={() => setBet(Math.max(1, bet / 2))} disabled={gamePhase !== 'betting'} className="bet-modifier">½</button>
                  <input 
                    type="number" 
                    value={bet} 
                    onChange={(e) => setBet(Math.max(1, parseFloat(e.target.value) || 1))} 
                    disabled={gamePhase !== 'betting'}
                    className="bet-input"
                  />
                  <span className="currency">₽</span>
                  <button onClick={() => setBet(Math.min(user?.balance || 10000, bet * 2))} disabled={gamePhase !== 'betting'} className="bet-modifier">×2</button>
                </div>
              </div>
            </div>
            
            <div className="control-row">
              <div className="control-group full-width">
                <label>
                  <i className="fa-solid fa-chart-line"></i> Автовывод
                  <span className="autocashout-value">{autoCashout.toFixed(1)}x</span>
                </label>
                <input
                  type="range"
                  min="1.1"
                  max="10"
                  step="0.1"
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(parseFloat(e.target.value))}
                  disabled={gamePhase !== 'betting'}
                  className="cashout-slider"
                />
                <div className="quick-cashout">
                  {[1.5, 2, 3, 5, 10].map(x => (
                    <button
                      key={x}
                      onClick={() => setAutoCashout(x)}
                      disabled={gamePhase !== 'betting'}
                      className={`quick-btn ${autoCashout === x ? 'active' : ''}`}
                    >
                      {x}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {result && (
              <div className={`game-result ${result.status}`}>
                <i className={`fa-solid ${result.status === 'win' ? 'fa-trophy' : 'fa-xmark'}`}></i>
                <span>
                  {result.status === 'win' 
                    ? `Выигрыш ${result.win.toFixed(2)}₽ (${autoCashout}x)` 
                    : `Краш на ${result.crashPoint}x`}
                </span>
              </div>
            )}
            
            {gamePhase === 'betting' && !betId ? (
              <button className="play-button" onClick={placeBet} disabled={loading || !user} data-testid="crash-play-btn">
                {loading ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Обработка...</>
                ) : (
                  <>
                    <i className="fa-solid fa-play"></i>
                    Поставить {bet}₽
                  </>
                )}
              </button>
            ) : (
              <button className="play-button waiting" disabled data-testid="crash-play-btn">
                {gamePhase === 'waiting' ? (
                  <><i className="fa-solid fa-clock"></i> Ожидание...</>
                ) : gamePhase === 'crashed' ? (
                  <><i className="fa-solid fa-hourglass"></i> Следующий раунд...</>
                ) : betId ? (
                  <><i className="fa-solid fa-check-circle"></i> Ставка принята</>
                ) : (
                  <><i className="fa-solid fa-rocket"></i> Игра идёт...</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const X100Game = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [bet, setBet] = useState(10);
  const [selectedCoef, setSelectedCoef] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinCount, setSpinCount] = useState(0);

  const coefficients = [2, 3, 10, 15, 20, 100];
  const colors = { 
    2: '#4ade80',   // Green
    3: '#60a5fa',   // Blue  
    10: '#f472b6',  // Pink
    15: '#fbbf24',  // Yellow/Gold
    20: '#a78bfa',  // Purple
    100: '#ef4444'  // Red (Jackpot)
  };

  // Exact wheel positions matching backend X100_WHEEL
  const wheelData = [
    2, 3, 2, 15, 2, 3, 2, 20, 2, 15, 2, 3, 2, 3, 2, 15, 2, 3, 10, 3, 2, 10, 2, 3, 2,
    100, // Position 25 - Jackpot
    2, 3, 2, 10, 2, 3, 2, 3, 2, 15, 2, 3, 2, 3, 2, 20, 2, 3, 2, 10, 2, 3, 2, 10,
    2, 3, 2, 15, 2, 3, 2, 3, 2, 10, 20, 3, 2, 3, 2, 15, 2, 10, 2, 3, 2, 20, 2, 3, 2,
    15, 2, 3, 2, 10, 2, 3, 2, 3, 2, 10, 2, 3, 2, 3, 2, 10, 2, 3, 2, 3, 2, 3, 2
  ];

  const totalSegments = wheelData.length;
  const segmentAngle = 360 / totalSegments;

  const play = async () => {
    if (!user) return navigate('/login');
    if (user.balance < bet) return toast.error('Недостаточно средств');
    
    setLoading(true);
    setSpinning(true);
    setResult(null);
    
    try {
      const res = await api.post('/games/x100/play', { bet, coef: selectedCoef });
      
      if (res.data.success) {
        const position = res.data.position;
        
        // Calculate the exact rotation needed
        // Pointer is at TOP (12 o'clock position)
        // Segment 0 starts at TOP and goes clockwise
        // To land on segment N, we rotate the wheel so segment N is at TOP
        // Rotation is clockwise, so we need: -(position * segmentAngle) - segmentAngle/2
        // The -segmentAngle/2 centers the pointer in the middle of the segment
        
        const fullRotations = 360 * (5 + spinCount); // Multiple full rotations for effect
        const targetAngle = position * segmentAngle + segmentAngle / 2;
        const finalRotation = fullRotations + (360 - targetAngle);
        
        setRotation(finalRotation);
        setSpinCount(prev => prev + 1);
        
        setTimeout(() => {
          setSpinning(false);
          setResult(res.data);
          updateBalance(res.data.balance);
          
          if (res.data.status === 'win') {
            toast.success(`🎉 Победа! +${res.data.win?.toFixed(2)}₽ (x${res.data.result_coef})`);
          } else {
            toast.error(`Выпало x${res.data.result_coef}. Вы выбрали x${selectedCoef}`);
          }
          setLoading(false);
        }, 4000);
      }
    } catch (e) {
      setSpinning(false);
      toast.error(e.response?.data?.detail || 'Ошибка');
      setLoading(false);
    }
  };

  return (
    <div className="page game-page x100-page" data-testid="x100-page">
      <div className="game-container">
        <div className="game-board x100-board" data-testid="x100-board">
          <div className="x100-wheel-container">
            {/* SVG Wheel - segments start from top (12 o'clock) and go clockwise */}
            <svg 
              viewBox="0 0 200 200" 
              className="x100-wheel-svg"
              style={{ 
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
              }}
            >
              {wheelData.map((coef, i) => {
                // Each segment spans segmentAngle degrees
                // Start from -90 so first segment is at top (12 o'clock)
                const startAngle = (i * segmentAngle) - 90;
                const endAngle = ((i + 1) * segmentAngle) - 90;
                const startRad = startAngle * Math.PI / 180;
                const endRad = endAngle * Math.PI / 180;
                const x1 = 100 + 95 * Math.cos(startRad);
                const y1 = 100 + 95 * Math.sin(startRad);
                const x2 = 100 + 95 * Math.cos(endRad);
                const y2 = 100 + 95 * Math.sin(endRad);
                
                return (
                  <path
                    key={i}
                    d={`M 100 100 L ${x1} ${y1} A 95 95 0 0 1 ${x2} ${y2} Z`}
                    fill={colors[coef]}
                    stroke="#1a1a2e"
                    strokeWidth="0.5"
                  />
                );
              })}
              <circle cx="100" cy="100" r="35" fill="#1a1a2e" stroke="#fbbf24" strokeWidth="3"/>
            </svg>
            
            {/* Pointer at top */}
            <div className="x100-pointer"></div>
            
            {/* Center display */}
            <div className="x100-center">
              {result ? (
                <div className={`x100-result ${result.status}`}>
                  <div className="x100-result-coef" style={{ color: colors[result.result_coef] }}>x{result.result_coef}</div>
                  <div className="x100-result-win">{result.win > 0 ? `+${result.win?.toFixed(2)}₽` : '0₽'}</div>
                </div>
              ) : (
                <div className="x100-logo">x100</div>
              )}
            </div>
          </div>
        </div>
        
        <div className="game-controls" data-testid="x100-controls">
          <h2><i className="fa-solid fa-circle-notch"></i> X100</h2>
          
          <div className="control-group">
            <label>Выберите множитель</label>
            <div className="x100-coefs">
              {coefficients.map(c => (
                <button 
                  key={c} 
                  className={`x100-coef-btn ${selectedCoef === c ? 'active' : ''}`}
                  onClick={() => setSelectedCoef(c)}
                  style={{ 
                    backgroundColor: colors[c],
                    borderColor: selectedCoef === c ? '#fff' : 'transparent',
                    transform: selectedCoef === c ? 'scale(1.1)' : 'scale(1)'
                  }}
                  disabled={loading}
                >
                  x{c}
                </button>
              ))}
            </div>
          </div>
          
          <div className="control-group">
            <label>Ставка</label>
            <div className="bet-input">
              <button onClick={() => setBet(Math.max(1, bet / 2))} disabled={loading}>½</button>
              <input type="number" value={bet} onChange={e => setBet(Math.max(1, +e.target.value))} disabled={loading} data-testid="x100-bet-input" />
              <button onClick={() => setBet(Math.min(user?.balance || 1000, bet * 2))} disabled={loading}>×2</button>
            </div>
          </div>
          
          <div className="potential-win" style={{ 
            background: `linear-gradient(135deg, ${colors[selectedCoef]}20, transparent)`,
            borderLeft: `4px solid ${colors[selectedCoef]}`
          }}>
            При выигрыше x{selectedCoef}: <strong style={{ color: colors[selectedCoef] }}>{(bet * selectedCoef).toFixed(2)} ₽</strong>
          </div>
          
          <button className="btn-start" onClick={play} disabled={loading} data-testid="x100-play-btn">
            {loading ? (
              spinning ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Крутится...</> : <i className="fa-solid fa-spinner fa-spin"></i>
            ) : <><i className="fa-solid fa-play"></i> Крутить</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// Policy Page

// Support Chat Component
const SupportChat = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [user, open]);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/support/messages');
      if (res.data.success) setMessages(res.data.messages);
    } catch (e) {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      await api.post('/support/message', { message: newMessage });
      setNewMessage('');
      fetchMessages();
    } catch (e) {
      toast.error('Ошибка отправки');
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <>
      <button className="support-btn" onClick={() => setOpen(!open)} data-testid="support-btn">
        <i className="fa-solid fa-headset"></i>
      </button>
      {open && (
        <div className="support-chat" data-testid="support-chat">
          <div className="support-header">
            <h3><i className="fa-solid fa-headset"></i> Поддержка</h3>
            <button onClick={() => setOpen(false)}><i className="fa-solid fa-times"></i></button>
          </div>
          <div className="support-messages">
            {messages.length === 0 ? (
              <div className="no-messages">
                <i className="fa-solid fa-comments"></i>
                <p>Напишите нам, мы всегда на связи!</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`support-message ${msg.is_admin ? 'admin' : 'user'}`}>
                  <div className="msg-sender">{msg.is_admin ? 'Поддержка' : 'Вы'}</div>
                  <div className="msg-text">{msg.message}</div>
                  <div className="msg-time">{new Date(msg.created_at).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>
          <div className="support-input">
            <input 
              type="text" 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="Введите сообщение..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
};


const PolicyPage = () => (
  <div className="page legal-page" data-testid="policy-page">
    <div className="legal-content">
      <h1><i className="fa-solid fa-shield-halved"></i> Политика конфиденциальности</h1>
      
      <section>
        <h3>1. Какая информация подлежит сбору</h3>
        <p>1.1. Сбору подлежат только сведения, обеспечивающие возможность поддержки обратной связи с пользователем.</p>
        <p>1.2. Некоторые действия пользователей автоматически сохраняются в журналах сервера:</p>
        <p>1.2.1. IP-адрес, данные о типе браузера;</p>
        <p>1.2.2. Надстройках, времени запроса и т. д.</p>
      </section>
      
      <section>
        <h3>2. Как используется полученная информация</h3>
        <p>2.1. Сведения, предоставленные пользователем, используются для связи с ним, в том числе для направления уведомлений.</p>
      </section>
      
      <section>
        <h3>3. Управление личными данными</h3>
        <p>3.1. Личные данные доступны для просмотра, изменения и удаления в личном кабинете пользователя.</p>
        <p>3.2. В целях предотвращения случайного удаления или повреждения данных информация хранится в резервных копиях в течение 7 дней и может быть восстановлена по запросу пользователя.</p>
      </section>
      
      <section>
        <h3>4. Предоставление данных третьим лицам</h3>
        <p>4.1. Личные данные пользователей могут быть переданы лицам, не связанным с настоящим сайтом, если это необходимо:</p>
        <p>4.1.1. Для соблюдения закона, нормативно-правового акта, исполнения решения суда;</p>
        <p>4.1.2. Для выявления или воспрепятствования мошенничеству;</p>
        <p>4.1.3. Для устранения технических неисправностей в работе сайта;</p>
        <p>4.1.4. Для предоставления информации на основании запроса уполномоченных государственных органов.</p>
      </section>
      
      <section>
        <h3>5. Безопасность данных</h3>
        <p>5.1. Администрация сайта принимает все меры для защиты данных пользователей от несанкционированного доступа.</p>
      </section>
      
      <section>
        <h3>6. Изменения</h3>
        <p>6.1. Обновления политики конфиденциальности публикуются на данной странице.</p>
      </section>
    </div>
  </div>
);

// Terms Page
const TermsPage = () => (
  <div className="page legal-page" data-testid="terms-page">
    <div className="legal-content">
      <h1><i className="fa-solid fa-file-contract"></i> Пользовательское соглашение</h1>
      
      <div className="legal-warning">
        <i className="fa-solid fa-exclamation-triangle"></i>
        Если Вы не согласны с условиями настоящего Пользовательского Соглашения, не авторизуйтесь на Сайте EASY MONEY и не используйте сервисы данного Сайта.
      </div>
      
      <section>
        <h3>1. Термины и определения</h3>
        <p>1.1.1 <strong>Сайт</strong> - совокупность информации, текстов, графических элементов, дизайна, изображений и иных результатов интеллектуальной деятельности, доступных по адресу EASY MONEY.</p>
        <p>1.1.2 <strong>Соглашение</strong> – настоящее Пользовательское Соглашение, являющееся Публичной офертой.</p>
        <p>1.1.3 <strong>Администратор</strong> – лицо, в коммерческом управлении которого находится Сайт.</p>
        <p>1.1.4 <strong>Пользователь</strong> – лицо, заключившее с Администратором Соглашение путем акцепта настоящей оферты.</p>
        <p>1.1.5 <strong>Монеты</strong> – виртуальная игровая единица Сайта, используемая для получения Услуги.</p>
      </section>
      
      <section>
        <h3>2. Предмет соглашения</h3>
        <p>2.1 Предметом настоящего Соглашения является предложение Администратора получать с использованием сервисов Сайта развлекательно-аттракционные Услуги.</p>
        <p>2.2 Лицо, акцептовавшее настоящую оферту, становится Пользователем и обязуется использовать Сайт только на условиях настоящего Соглашения.</p>
        <p>2.3 Пользование Услугами Сайта лицами, не обладающими полной дееспособностью, ЗАПРЕЩЕНО.</p>
      </section>
      
      <section>
        <h3>3. Услуги сайта</h3>
        <p>4.1 Услуги, оказываемые на Сайте, являются зрелищно-развлекательными и аттракционными (программа-симулятор).</p>
        <p>4.2 Неиспользованные виртуальные игровые единицы могут быть возвращены пользователю в соответствии со стоимостью их приобретения.</p>
      </section>
      
      <section>
        <h3>4. Порядок пользования</h3>
        <p>5.4 Запрещается использовать автокликер при игре на Сайте. При нарушении вы будете заблокированы.</p>
        <p>5.12 Пользователям ЗАПРЕЩЕНО регистрировать более 1 учетной записи без предварительного согласования с администрацией.</p>
        <p>5.17 ЗАПРЕЩЕНО промывать средства через перевод либо переводить с мультиаккаунтов на чистый аккаунт.</p>
      </section>
      
      <section>
        <h3>5. Оплата</h3>
        <p>6.1 Цены за монеты на Сайте устанавливаются Администратором и могут быть изменены по решению Администратора.</p>
        <p>6.6 Все оплаченные Услуги Сайта являются добровольными пожертвованиями со стороны Пользователя.</p>
      </section>
      
      <section>
        <h3>6. Ответственность</h3>
        <p>8.1 В случае нарушения Пользователем условий настоящего Соглашения, Администратор вправе заблокировать или удалить с Сайта аккаунт Пользователя.</p>
        <p>8.2 Администратор не отвечает за работоспособность Сайта и не гарантирует его бесперебойной работы.</p>
      </section>
    </div>
  </div>
);

// Admin Panel
const AdminLogin = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const login = async () => {
    setLoading(true);
    try {
      const res = await api.post('/admin/login', { password });
      if (res.data.success) {
        localStorage.setItem('adminToken', res.data.token);
        navigate('/apminpannelonlyadmins/dashboard');
      }
    } catch (e) {
      toast.error('Неверный пароль');
    }
    setLoading(false);
  };

  return (
    <div className="admin-login" data-testid="admin-login">
      <div className="admin-login-card">
        <img src="/logo.png" alt="EASY MONEY" />
        <h2>Админ панель</h2>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" data-testid="admin-password" />
        <button onClick={login} disabled={loading} data-testid="admin-login-btn">
          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Войти'}
        </button>
      </div>
    </div>
  );
};


// Support Admin Panel Component
const SupportAdminPanel = ({ adminApi }) => {
  const [chats, setChats] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  const fetchChats = async () => {
    try {
      const res = await adminApi.get('/admin/support/chats');
      if (res.data.success) setChats(res.data.chats);
    } catch (e) {}
  };

  const fetchMessages = async () => {
    if (!selectedUser) return;
    try {
      const res = await adminApi.get(`/admin/support/messages/${selectedUser._id}`);
      if (res.data.success) setMessages(res.data.messages);
    } catch (e) {}
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedUser) return;
    try {
      await adminApi.post(`/admin/support/reply/${selectedUser._id}`, { message: replyText });
      setReplyText('');
      fetchMessages();
      fetchChats();
      toast.success('Ответ отправлен');
    } catch (e) {
      toast.error('Ошибка отправки');
    }
  };

  return (
    <div className="support-admin-container">
      <div className="support-chats-list">
        <h3>Чаты ({chats.length})</h3>
        {chats.map((chat, i) => (
          <div 
            key={i} 
            className={`chat-item ${selectedUser?._id === chat._id ? 'active' : ''} ${chat.unread_count > 0 ? 'unread' : ''}`}
            onClick={() => setSelectedUser(chat)}
          >
            <div className="chat-name">{chat.user_name}</div>
            <div className="chat-preview">{chat.last_message?.substring(0, 50)}...</div>
            <div className="chat-meta">
              <span className="chat-time">{new Date(chat.last_time).toLocaleTimeString()}</span>
              {chat.unread_count > 0 && <span className="chat-badge">{chat.unread_count}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="support-chat-window">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>{selectedUser.user_name}</h3>
              <small>ID: {selectedUser._id}</small>
            </div>
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.is_admin ? 'admin' : 'user'}`}>
                  <div className="msg-sender">{msg.is_admin ? '👨‍💼 Поддержка' : '👤 Пользователь'}</div>
                  <div className="msg-text">{msg.message}</div>
                  <div className="msg-time">{new Date(msg.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="chat-reply">
              <textarea 
                value={replyText} 
                onChange={e => setReplyText(e.target.value)}
                placeholder="Введите ответ..."
                rows="3"
              />
              <button onClick={sendReply} disabled={!replyText.trim()}>
                <i className="fa-solid fa-paper-plane"></i> Отправить
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <i className="fa-solid fa-comments"></i>
            <p>Выберите чат из списка</p>
          </div>
        )}
      </div>
    </div>
  );
};


const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [promos, setPromos] = useState([]);
  const [tab, setTab] = useState('stats');
  const [search, setSearch] = useState('');
  const [newPromo, setNewPromo] = useState({ name: '', reward: 100, limit: 100, type: 0, deposit_required: false, wager_multiplier: 3, bonus_percent: 0 });
  const [rtpSettings, setRtpSettings] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const navigate = useNavigate();

  const adminApi = axios.create({ baseURL: API });
  adminApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) navigate('/apminpannelonlyadmins');
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    try {
      if (tab === 'stats' || tab === 'rtp') {
        const res = await adminApi.get('/admin/stats');
        if (res.data.success) {
          setStats(res.data);
          setRtpSettings(res.data.settings || {});
        }
      } else if (tab === 'users') {
        const res = await adminApi.get(`/admin/users?search=${search}`);
        if (res.data.success) setUsers(res.data.users);
      } else if (tab === 'withdraws') {
        const res = await adminApi.get('/admin/withdraws');
        if (res.data.success) setWithdraws(res.data.withdraws);
      } else if (tab === 'promos') {
        const res = await adminApi.get('/admin/promos');
        if (res.data.success) setPromos(res.data.promos);
      } else if (tab === 'support') {
        // Support data fetched within SupportAdminPanel component
      }
    } catch (e) {
      if (e.response?.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/apminpannelonlyadmins');
      }
    }
  };

  const updateWithdraw = async (id, status) => {
    try {
      await adminApi.put(`/admin/withdraw/${id}?status=${status}`);
      toast.success('Обновлено');
      fetchData();
    } catch (e) {
      toast.error('Ошибка');
    }
  };

  const createPromo = async () => {
    try {
      await adminApi.post('/admin/promo', newPromo);
      toast.success('Промокод создан');
      setNewPromo({ name: '', reward: 100, limit: 100, type: 0, deposit_required: false, wager_multiplier: 3, bonus_percent: 0 });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
  };

  const updateRTP = async () => {
    try {
      await adminApi.put('/admin/rtp', rtpSettings);
      toast.success('RTP обновлен');
    } catch (e) {
      toast.error('Ошибка');
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;
    try {
      await adminApi.put('/admin/user', editingUser);
      toast.success('Пользователь обновлен');
      setEditingUser(null);
      fetchData();
    } catch (e) {
      toast.error('Ошибка');
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/apminpannelonlyadmins');
  };

  const promoTypes = ['Баланс', 'Бонус к депозиту %', 'Фриспины', 'Без вейджера', 'Кешбэк'];

  return (
    <div className="admin-dashboard" data-testid="admin-dashboard">
      <div className="admin-sidebar">
        <div className="admin-logo">
          <img src="/logo.png" alt="EASY MONEY" />
          <span>Admin</span>
        </div>
        <nav>
          <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}><i className="fa-solid fa-chart-pie"></i> Статистика</button>
          <button className={tab === 'rtp' ? 'active' : ''} onClick={() => setTab('rtp')}><i className="fa-solid fa-percent"></i> RTP</button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><i className="fa-solid fa-users"></i> Пользователи</button>
          <button className={tab === 'withdraws' ? 'active' : ''} onClick={() => setTab('withdraws')}><i className="fa-solid fa-money-bill-transfer"></i> Выводы</button>
          <button className={tab === 'promos' ? 'active' : ''} onClick={() => setTab('promos')}><i className="fa-solid fa-ticket"></i> Промокоды</button>
          <button className={tab === 'support' ? 'active' : ''} onClick={() => setTab('support')}><i className="fa-solid fa-headset"></i> Поддержка</button>
          <button onClick={logout}><i className="fa-solid fa-sign-out"></i> Выход</button>
        </nav>
      </div>

      <div className="admin-content">
        {tab === 'stats' && stats && (
          <div className="admin-stats" data-testid="admin-stats">
            <h2>Статистика</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Депозиты сегодня</h4>
                <div className="stat-value">{stats.payments.today?.toFixed(2)} ₽</div>
              </div>
              <div className="stat-card">
                <h4>Депозиты за неделю</h4>
                <div className="stat-value">{stats.payments.week?.toFixed(2)} ₽</div>
              </div>
              <div className="stat-card">
                <h4>Депозиты всего</h4>
                <div className="stat-value">{stats.payments.all?.toFixed(2)} ₽</div>
              </div>
              <div className="stat-card">
                <h4>Ожидающие выводы</h4>
                <div className="stat-value">{stats.withdrawals.pending_count} ({stats.withdrawals.pending_sum?.toFixed(2)} ₽)</div>
              </div>
              <div className="stat-card">
                <h4>Пользователей</h4>
                <div className="stat-value">{stats.users.all}</div>
              </div>
              <div className="stat-card">
                <h4>Новых сегодня</h4>
                <div className="stat-value">{stats.users.today}</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'rtp' && (
          <div className="admin-rtp" data-testid="admin-rtp">
            <h2>Настройки RTP (Return To Player)</h2>
            <p className="rtp-desc">RTP определяет процент возврата игроку. Чем выше RTP, тем чаще игроки выигрывают.</p>
            <div className="rtp-grid">
              {['dice', 'mines', 'bubbles', 'wheel', 'crash', 'x100'].map(game => (
                <div key={game} className="rtp-item">
                  <label>{game.charAt(0).toUpperCase() + game.slice(1)} RTP</label>
                  <div className="rtp-input">
                    <input 
                      type="range" 
                      min="90" 
                      max="99.9" 
                      step="0.1"
                      value={rtpSettings[`${game}_rtp`] || 97}
                      onChange={e => setRtpSettings({...rtpSettings, [`${game}_rtp`]: parseFloat(e.target.value)})}
                    />
                    <span>{rtpSettings[`${game}_rtp`] || 97}%</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-save-rtp" onClick={updateRTP}>Сохранить RTP</button>
          </div>
        )}

        {tab === 'users' && (
          <div className="admin-users" data-testid="admin-users">
            <h2>Пользователи</h2>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} onKeyUp={e => e.key === 'Enter' && fetchData()} placeholder="Поиск..." />
            
            {editingUser && (
              <div className="edit-user-modal">
                <div className="edit-user-content">
                  <h3>Редактирование: {editingUser.name}</h3>
                  <div className="edit-field">
                    <label>Баланс</label>
                    <input type="number" value={editingUser.balance || 0} onChange={e => setEditingUser({...editingUser, balance: +e.target.value})} />
                  </div>
                  <div className="edit-field">
                    <label>Drain</label>
                    <input type="checkbox" checked={editingUser.is_drain || false} onChange={e => setEditingUser({...editingUser, is_drain: e.target.checked})} />
                  </div>
                  <div className="edit-field">
                    <label>Drain %</label>
                    <input type="number" value={editingUser.is_drain_chance || 20} onChange={e => setEditingUser({...editingUser, is_drain_chance: +e.target.value})} />
                  </div>
                  <div className="edit-field">
                    <label>Youtuber</label>
                    <input type="checkbox" checked={editingUser.is_youtuber || false} onChange={e => setEditingUser({...editingUser, is_youtuber: e.target.checked})} />
                  </div>
                  <div className="edit-field">
                    <label>Бан</label>
                    <input type="checkbox" checked={editingUser.is_ban || false} onChange={e => setEditingUser({...editingUser, is_ban: e.target.checked})} />
                  </div>
                  <div className="edit-buttons">
                    <button onClick={updateUser}>Сохранить</button>
                    <button onClick={() => setEditingUser(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
            
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Имя</th>
                  <th>Баланс</th>
                  <th>Депозит</th>
                  <th>IP</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={u.is_ban ? 'banned' : ''}>
                    <td>{u.id.slice(0, 8)}</td>
                    <td>{u.name} {u.is_youtuber && '⭐'} {u.is_drain && '🎯'}</td>
                    <td>{u.balance?.toFixed(2)} ₽</td>
                    <td>{u.deposit?.toFixed(2)} ₽</td>
                    <td>{u.register_ip || '-'}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-edit" onClick={() => setEditingUser({user_id: u.id, ...u})}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'withdraws' && (
          <div className="admin-withdraws" data-testid="admin-withdraws">
            <h2>Заявки на вывод</h2>
            <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Сумма</th>
                  <th>Кошелёк</th>
                  <th>Баланс</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {withdraws.map(w => (
                  <tr key={w.id}>
                    <td>{w.user_name}</td>
                    <td>{w.amount?.toFixed(2)} ₽</td>
                    <td>{w.wallet}</td>
                    <td>{w.user_balance?.toFixed(2)} ₽</td>
                    <td>
                      <button className="btn-approve" onClick={() => updateWithdraw(w.id, 'completed')}>✓</button>
                      <button className="btn-reject" onClick={() => updateWithdraw(w.id, 'rejected')}>✗</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'promos' && (
          <div className="admin-promos" data-testid="admin-promos">
            <h2>Промокоды</h2>
            <div className="promo-form-advanced">
              <div className="promo-row">
                <input type="text" value={newPromo.name} onChange={e => setNewPromo({...newPromo, name: e.target.value})} placeholder="Название" />
                <select value={newPromo.type} onChange={e => setNewPromo({...newPromo, type: +e.target.value})}>
                  {promoTypes.map((t, i) => <option key={i} value={i}>{t}</option>)}
                </select>
              </div>
              <div className="promo-row">
                <input type="number" value={newPromo.reward} onChange={e => setNewPromo({...newPromo, reward: +e.target.value})} placeholder="Награда ₽" />
                <input type="number" value={newPromo.limit} onChange={e => setNewPromo({...newPromo, limit: +e.target.value})} placeholder="Лимит" />
              </div>
              <div className="promo-row">
                <input type="number" value={newPromo.wager_multiplier} onChange={e => setNewPromo({...newPromo, wager_multiplier: +e.target.value})} placeholder="Вейджер x" />
                <input type="number" value={newPromo.bonus_percent} onChange={e => setNewPromo({...newPromo, bonus_percent: +e.target.value})} placeholder="Бонус к депозиту %" />
              </div>
              <div className="promo-row">
                <label><input type="checkbox" checked={newPromo.deposit_required} onChange={e => setNewPromo({...newPromo, deposit_required: e.target.checked})} /> Требуется депозит</label>
                <button onClick={createPromo}>Создать</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Награда</th>
                  <th>Вейджер</th>
                  <th>Использовано</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{promoTypes[p.type] || 'Баланс'}</td>
                    <td>{p.type === 1 ? `${p.bonus_percent}%` : `${p.reward}₽`}</td>
                    <td>x{p.wager_multiplier || 3}</td>
                    <td>{p.limited}/{p.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'support' && (
          <div className="admin-support" data-testid="admin-support">
            <h2>Поддержка пользователей</h2>
            <SupportAdminPanel adminApi={adminApi} />
          </div>
        )}

      </div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><i className="fa-solid fa-spinner fa-spin"></i></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

// Main App
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/auth/me');
        if (res.data.success) setUser(res.data.user);
      } catch (e) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateBalance = (newBalance) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateBalance }}>
      <BrowserRouter>
        <div className="App">
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/apminpannelonlyadmins" element={<AdminLogin />} />
            <Route path="/apminpannelonlyadmins/dashboard" element={<AdminDashboard />} />
            <Route path="/*" element={
              <>
                <Header />
                <main>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/mines" element={<MinesGame />} />
                    <Route path="/dice" element={<DiceGame />} />
                    <Route path="/bubbles" element={<BubblesGame />} />
                    <Route path="/wheel" element={<WheelGame />} />
                    <Route path="/crash" element={<CrashGame />} />
                    <Route path="/x100" element={<X100Game />} />
                    <Route path="/policy" element={<PolicyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
                    <Route path="/payment/success" element={<PaymentSuccess />} />
                    <Route path="/payment/failed" element={<PaymentFailed />} />
                    <Route path="/bonus" element={<ProtectedRoute><Bonus /></ProtectedRoute>} />
                    <Route path="/ref" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
                  </Routes>
                </main>
                <Footer />
                <SupportChat />
              </>
            } />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
