jest.mock("../db/pool", () => ({
    query: jest.fn(),
    connect: jest.fn(),
  }));