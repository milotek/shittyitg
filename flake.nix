{
  description = "shitITG, a browser rhythm game for displaying modcharts";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_24
            pkgs.python3
            pkgs.uv
            pkgs.biome
          ];

          # npm's Biome ships a generic-linux binary that NixOS cannot load,
          # so the launcher is pointed at nixpkgs' build of the same version.
          BIOME_BINARY = "${pkgs.biome}/bin/biome";
          UV_PYTHON = "${pkgs.python3}/bin/python3";
          UV_PYTHON_DOWNLOADS = "never";
        };
      });
    };
}
