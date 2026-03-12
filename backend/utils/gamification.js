const userSchema = require("../schemas/userModel");
const notificationSchema = require("../schemas/notificationModel");
const { emitToUser } = require("./realtime");

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isYesterday = (a, b) => {
  if (!a || !b) return false;
  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.round((x.getTime() - y.getTime()) / (24 * 60 * 60 * 1000));
  return diff === 1;
};

const createBadgeList = (user) => {
  const result = new Set(user.badges || []);
  if (Number(user.points || 0) >= 100) result.add("Century Learner");
  if (Number(user.points || 0) >= 500) result.add("Knowledge Titan");
  if (Number(user.streakDays || 0) >= 7) result.add("7-Day Streak");
  if (Number(user.streakDays || 0) >= 30) result.add("30-Day Streak");
  return [...result];
};

const awardLearningActivity = async ({ userId, points = 0, reason = "Learning update", courseId = null }) => {
  const user = await userSchema.findById(userId);
  if (!user) return null;

  const now = new Date();
  const lastLearning = user.lastLearningDate ? new Date(user.lastLearningDate) : null;
  if (!lastLearning) {
    user.streakDays = 1;
  } else if (!isSameDay(now, lastLearning)) {
    user.streakDays = isYesterday(now, lastLearning) ? Number(user.streakDays || 0) + 1 : 1;
  }

  user.lastLearningDate = now;
  user.points = Number(user.points || 0) + Math.max(Number(points || 0), 0);

  const oldBadges = new Set(user.badges || []);
  user.badges = createBadgeList(user);
  const newBadges = user.badges.filter((badge) => !oldBadges.has(badge));
  await user.save();

  if (newBadges.length > 0) {
    const note = await notificationSchema.create({
      userId,
      type: "badge",
      title: "New badges unlocked",
      message: `You earned: ${newBadges.join(", ")}`,
      meta: { badges: newBadges, courseId },
    });
    emitToUser(String(userId), "notification:new", note);
  }

  const payload = {
    userId: String(user._id),
    points: Number(user.points || 0),
    streakDays: Number(user.streakDays || 0),
    badges: user.badges || [],
    reason,
    courseId,
  };
  emitToUser(String(user._id), "student:gamification-updated", payload);
  return payload;
};

module.exports = {
  awardLearningActivity,
};
