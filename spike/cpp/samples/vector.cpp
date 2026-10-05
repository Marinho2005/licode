#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

int main() {
  std::vector<std::string> v = {"zeta", "alpha", "beta"};
  std::sort(v.begin(), v.end());
  for (const auto& s : v) {
    std::cout << s << '\n';
  }
  return 0;
}
