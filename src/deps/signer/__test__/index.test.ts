import { Main } from "..";

jest.spyOn(Date, "now");

describe("Singer", () => {
  const signer = Main();
  describe("generator", () => {
    it("case1", () => {
      const signature = signer.generator(
        {
          uri: "/users",
          key: "test key",
          method: "",
          signMethod: "HmacSHA256",
          signVersion: "1",
          timestamp: 337008447,
        },
        "secret key",
      );

      expect(signature).toBe("0iZkHO/G+ZXYFmyYBLjoxyqQYGTx20TqlaBTfk4BHmI=");
      expect(typeof signature).toBe("string");
    });
  });

  describe("request", () => {
    it("case1", () => {
      (Date.now as any).mockReturnValueOnce(337008447 * 1000);
      const info = signer.request("/users", "", "test key", "secret key");
      expect(typeof info).toBe("object");
      expect(info).toEqual({
        "x-auth-signature": "0iZkHO/G+ZXYFmyYBLjoxyqQYGTx20TqlaBTfk4BHmI=",
        "x-auth-key": "test key",
        "x-auth-method": "",
        "x-auth-timestamp": "337008447",
        "x-auth-sign-method": "HmacSHA256",
        "x-auth-sign-version": "1",
      });
    });
  });
});
