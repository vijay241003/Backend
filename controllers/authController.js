const { UserModel }     = require('../models/db');
const { generateToken } = require('../middleware/auth');

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    let user;
    try {
      user = await UserModel.create({ name, email, password });
    } catch (err) {
      if (err.message === 'EMAIL_TAKEN') {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }
      throw err;
    }
    const token = generateToken(user.id);
    console.log('Registered:', user.email);
    return res.status(201).json({ success: true, message: 'Account created successfully!', token, user });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const rawUser = UserModel.findByEmailRaw(email);
    if (!rawUser) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const isMatch = await UserModel.verifyPassword(password, rawUser.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    UserModel.touchLogin(rawUser.id);
    const token = generateToken(rawUser.id);
    const user  = UserModel._sanitize(rawUser);
    console.log('Login:', user.email);
    return res.status(200).json({ success: true, message: 'Login successful.', token, user });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  [protected]
function getMe(req, res) {
  return res.status(200).json({ success: true, user: req.user });
}

// POST /api/auth/logout  [protected]
function logout(req, res) {
  console.log('Logout:', req.user.email);
  return res.status(200).json({ success: true, message: 'Logged out. Please delete the token on the client.' });
}

// PUT /api/auth/profile  [protected]
function updateProfile(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    const updated = UserModel.update(req.user.id, { name });
    return res.status(200).json({ success: true, message: 'Profile updated.', user: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, logout, updateProfile };
