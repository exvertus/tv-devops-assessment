import request from "supertest";
import app from "../app";

test("GET /health returns 200 status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
});