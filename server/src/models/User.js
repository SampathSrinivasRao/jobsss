import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['seeker', 'employer'], required: true },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.verifyPassword = function (password) { return bcrypt.compare(password, this.password); };
userSchema.methods.toJSON = function () {
  const { password, __v, ...safe } = this.toObject();
  return { ...safe, id: String(this._id) };
};

export const User = mongoose.model('User', userSchema);
