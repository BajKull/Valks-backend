import { CategoryScore, Channel } from "./types";
import * as schedule from "node-schedule";
import { admin, firestore } from "./firebase";
import { changeCod } from "./functions";

export const categoryOfDay = (channels: Channel[]) => {
  // run this everyday at midnight
  schedule.scheduleJob("0 0 * * *", async () => {
    const category = await setCategory(channels);
    changeCod(category);
  });
};

const setCategory = async (ch: Channel[]) => {
  const channels = ch.filter((c) => c.type === "public");
  const categoriesUsedDate = (
    await firestore.collection("cod").doc("categories").get()
  ).data();
  const now = new Date(Date.now()).getTime();
  const scores = [];

  channels.forEach((ch) => {
    const category = ch.category;
    let score = 0;

    // 86400000 miliseconds = day
    // messages sent in the last 24h
    const messages24H = ch.messages.filter((msg) => now - msg.date < 86400000);
    score += messages24H.length;

    // unique users that sent messages in the last 24h
    const authors = Array.from(
      new Set(messages24H.map((msg) => msg.author.email))
    );
    score += authors.length * 10;

    // users that are in the channel right now
    score += ch.users.length * 25;

    // how many times was this category already promoted?
    score += categoriesUsedDate[category].length * 250;

    const data = { category, score };
    scores.push(data);
  });

  // select all categories with lowest score
  const lowestScore: { category: string; score: number }[] = scores.reduce(
    (acc, current) => {
      if (current.score < acc[0].score) return [current];
      if (current.score === acc[0].score) return [...acc, current];
      return acc;
    },
    [scores[0]]
  );

  let selectedCategory: CategoryScore;

  if (lowestScore.length > 0) {
    const random = Math.floor(Math.random() * (lowestScore.length - 1));
    selectedCategory = lowestScore[random];
  } else selectedCategory[0] = lowestScore;
  await firestore
    .collection("cod")
    .doc("categories")
    .update({
      [selectedCategory.category]: admin.firestore.FieldValue.arrayUnion(now),
    })
    .catch((err) => console.log(err.message));
  await firestore
    .collection("cod")
    .doc("today")
    .set({ category: selectedCategory.category });

  return selectedCategory.category || "space";
};
